(() => {
  const MAX = 5;
  const sessionId = location.pathname.split('/').pop();

  /** @type {{ file: File, dataUrl: string, megapixels: number, quality: 'low'|'med'|'high' }[]} */
  const photos = [];

  const $ = (sel) => document.querySelector(sel);
  const grid = $('#previewGrid');
  const quota = $('#quota');
  const sendBtn = $('#sendBtn');
  const statusEl = $('#status');
  const filePicker = $('#filePicker');
  const cameraPicker = $('#cameraPicker');
  const consent = $('#consent');
  const nameInput = $('#name');

  const setStatus = (msg, kind) => {
    statusEl.textContent = msg || '';
    statusEl.className = 'status' + (kind ? ' ' + kind : '');
  };

  const computeQuality = (img) => {
    const mp = (img.naturalWidth * img.naturalHeight) / 1_000_000;
    let label = 'high';
    if (mp < 1.0) label = 'low';
    else if (mp < 2.5) label = 'med';
    return { mp, label };
  };

  const refresh = () => {
    grid.innerHTML = '';
    photos.forEach((p, i) => {
      const tile = document.createElement('div');
      tile.className = 'tile';

      const img = document.createElement('img');
      img.src = p.dataUrl;
      tile.appendChild(img);

      const badge = document.createElement('span');
      badge.className = 'quality ' + p.quality;
      badge.textContent =
        p.quality === 'low'  ? `${p.megapixels.toFixed(1)}MP · low` :
        p.quality === 'med'  ? `${p.megapixels.toFixed(1)}MP · ok`  :
                               `${p.megapixels.toFixed(1)}MP · good`;
      tile.appendChild(badge);

      const remove = document.createElement('button');
      remove.textContent = '×';
      remove.addEventListener('click', () => {
        photos.splice(i, 1);
        refresh();
      });
      tile.appendChild(remove);

      grid.appendChild(tile);
    });
    quota.textContent = `${photos.length} / ${MAX} selected`;
    updateSendState();
  };

  const updateSendState = () => {
    const ok = photos.length > 0 && nameInput.value.trim().length > 0 && consent.checked;
    sendBtn.disabled = !ok;
  };

  const readFile = (file) => new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Not an image: ' + file.name));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const { mp, label } = computeQuality(img);
        resolve({ file, dataUrl: reader.result, megapixels: mp, quality: label });
      };
      img.onerror = () => reject(new Error('Could not decode ' + file.name));
      img.src = reader.result;
    };
    reader.onerror = () => reject(reader.error || new Error('read failed'));
    reader.readAsDataURL(file);
  });

  const handleFiles = async (fileList) => {
    const remaining = MAX - photos.length;
    const taken = Array.from(fileList).slice(0, remaining);
    if (fileList.length > remaining) {
      setStatus(`Only ${remaining} more photo${remaining === 1 ? '' : 's'} allowed.`, 'error');
    }
    for (const f of taken) {
      try {
        const item = await readFile(f);
        photos.push(item);
      } catch (err) {
        setStatus(err.message, 'error');
      }
    }
    refresh();
  };

  filePicker.addEventListener('change', (e) => {
    handleFiles(e.target.files);
    e.target.value = '';
  });
  cameraPicker.addEventListener('change', (e) => {
    handleFiles(e.target.files);
    e.target.value = '';
  });

  consent.addEventListener('change', updateSendState);
  nameInput.addEventListener('input', updateSendState);

  sendBtn.addEventListener('click', async () => {
    if (photos.length === 0) return;
    sendBtn.disabled = true;
    setStatus('Uploading…', 'busy');

    const fd = new FormData();
    fd.append('name', nameInput.value.trim());
    fd.append('date', $('#date').value.trim());
    fd.append('consent', 'true');
    photos.forEach((p) => fd.append('images', p.file, p.file.name));

    try {
      const res = await fetch(`/api/sessions/${sessionId}/upload`, { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      setStatus('Sent! You can close this page now.', 'ok');
      grid.innerHTML = '';
      photos.length = 0;
      quota.textContent = '';
    } catch (err) {
      setStatus(err.message || 'Upload failed', 'error');
      sendBtn.disabled = false;
    }
  });
})();
