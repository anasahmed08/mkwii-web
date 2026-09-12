export async function translateIso(file, { serverUrl = '', onLog, onState } = {}) {
  const base = serverUrl.replace(/\/$/, '');
  const form = new FormData();
  form.append('iso', file, file.name);
  const upRes = await fetch(base + '/api/translate', { method: 'POST', body: form });
  if (!upRes.ok) throw new Error('upload failed: ' + upRes.status);
  const { id } = await upRes.json();
  await new Promise((resolve, reject) => {
    const es = new EventSource(base + '/api/translate/' + id + '/log');
    es.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'log' && onLog) onLog(msg.line);
      else if (msg.type === 'state' && onState) onState(msg);
      else if (msg.type === 'done') { es.close(); resolve(msg.result); }
      else if (msg.type === 'error') { es.close(); reject(new Error(msg.error)); }
    };
  });
  const finalRes = await fetch(base + '/api/translate/' + id);
  const final = await finalRes.json();
  if (final.status !== 'done') throw new Error(final.error || 'translation failed');
  return final.result;
}