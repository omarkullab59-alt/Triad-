// "Send to TRIAD": submits the render to the Darkroom of the TRIAD site, using its existing upload API
// (POST {DARKROOM_URL}/darkroom/submit, same format as the Darkroom upload form). Nothing is public before
// the TRIAD crew approves it.
import { DARKROOM_URL, DARKROOM_PAGE } from './config.js';
import { esc, toast, download, makeCanvas } from './dom.js';

const ERRORS = {
  daily_limit: 'You have reached today’s limit of 6 submissions. Try again tomorrow.',
  rate_limited: 'Too many tries in a short time. Wait a minute and try again.',
  origin_not_allowed: 'The TRIAD server does not accept submissions from this address yet.',
  name_required: 'Please add your name.',
  consent_required: 'Please tick the box to agree.',
  image_invalid: 'The image was too large. Try again.',
  not_configured: 'The Darkroom is not open yet.',
};

function toJpeg(canvas, maxW, q = 0.88) {
  const k = Math.min(1, maxW / canvas.width);
  const c = makeCanvas(Math.round(canvas.width * k), Math.round(canvas.height * k));
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(canvas, 0, 0, c.width, c.height);
  return { data: c.toDataURL('image/jpeg', q), width: c.width, height: c.height };
}

export async function openSendDialog({ makeImage, title, caption }) {
  const canvas = await makeImage();
  const preview = toJpeg(canvas, 540, 0.8).data;
  const dlg = document.createElement('dialog');
  dlg.setAttribute('aria-labelledby', 'send-h');
  const ready = !!DARKROOM_URL;
  dlg.innerHTML = `<form class="dlg" method="dialog">
    <div class="dlg-head"><h2 id="send-h" class="section-title">Send to TRIAD</h2><button class="icon-btn" value="cancel" aria-label="Close">×</button></div>
    <img src="${preview}" alt="Your design as it will be sent">
    ${ready ? `
    <p class="muted" style="font-size:14px">Your image goes to the TRIAD Darkroom. The crew looks at every submission; nothing is public before they approve it.</p>
    <div class="field"><label for="s-name">Your name (shown with the image)</label><input id="s-name" type="text" required maxlength="60" autocomplete="name"></div>
    <div class="field"><label for="s-ig">Instagram (optional)</label><input id="s-ig" type="text" maxlength="40" placeholder="@yourname" autocomplete="off"></div>
    <div class="field"><label for="s-title">Title</label><input id="s-title" type="text" maxlength="80" value="${esc(title)}"></div>
    <input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px">
    <label class="check"><input type="checkbox" id="s-ok" required> <span>I made this design and TRIAD may show it in the Darkroom and on @triad.closet with my name.</span></label>
    <p class="warn" data-err hidden></p>
    <div class="btn-row"><button class="btn btn--lime" value="send" data-send>Send</button><button class="btn" value="cancel">Cancel</button></div>`
    : `<p>The TRIAD Darkroom is not connected to the Studio yet. Save the image and upload it on the Darkroom page.</p>
    <div class="btn-row"><button class="btn btn--lime" value="save" data-save>Save image &amp; open Darkroom</button><button class="btn" value="cancel">Cancel</button></div>`}
  </form>`;
  document.body.append(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  dlg.showModal();

  if (!ready) {
    dlg.querySelector('[data-save]').addEventListener('click', (e) => {
      e.preventDefault();
      canvas.toBlob((b) => download(b, 'triad-studio.png'));
      window.open(DARKROOM_PAGE, '_blank', 'noopener');
      dlg.close();
    });
    return;
  }
  const err = dlg.querySelector('[data-err]');
  dlg.querySelector('[data-send]').addEventListener('click', async (e) => {
    e.preventDefault();
    const form = dlg.querySelector('form');
    if (!form.reportValidity()) return;
    const btn = e.currentTarget;
    btn.disabled = true; btn.textContent = 'Sending…'; err.hidden = true;
    const full = toJpeg(canvas, 1080, 0.88);
    const thumb = toJpeg(canvas, 600, 0.8);
    try {
      const res = await fetch(`${DARKROOM_URL}/darkroom/submit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: dlg.querySelector('#s-name').value, instagram: dlg.querySelector('#s-ig').value,
          title: dlg.querySelector('#s-title').value, caption, camera: 'TRIAD Studio',
          image: full.data, thumb: thumb.data, width: full.width, height: full.height,
          consent: dlg.querySelector('#s-ok').checked, website: form.website.value,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `http_${res.status}`);
      dlg.close();
      toast('Sent! The TRIAD crew will look at it soon.', 5000);
    } catch (ex) {
      err.textContent = ERRORS[ex.message] || 'Could not send right now. Check your connection and try again.';
      err.hidden = false;
      btn.disabled = false; btn.textContent = 'Send';
    }
  });
}
