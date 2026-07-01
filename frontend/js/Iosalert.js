/**
 * IosAlert.js
 * Universal iOS-style Alert for Web
 * Drop-in replacement — same API as the mobile CustomAlert.tsx
 *
 * USAGE:
 *   import IosAlert from './IosAlert.js'   (ES module)
 *   — or —
 *   <script src="IosAlert.js"></script>     (plain HTML, exposes window.IosAlert)
 *
 * API (mirrors CustomAlert.tsx exactly):
 *   IosAlert.alert(title, message?, buttons?)
 *   IosAlert.prompt(title, message?, callback?, type?, placeholder?)
 *   IosAlert.confirm(title, message?)           → Promise<boolean>  (bonus helper)
 *   IosAlert.toast(message, duration?)                               (bonus helper)
 */

const IosAlert = (() => {

  // ─── Inject styles once ───────────────────────────────────────
  const STYLE_ID = '__ios_alert_styles__';

  const injectStyles = () => {
    if (document.getElementById(STYLE_ID)) return;

    const css = `
      @import url('https://fonts.googleapis.com/css2?family=SF+Pro+Display:wght@400;600;700&display=swap');

      .ia-backdrop {
        position: fixed;
        inset: 0;
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        /* iOS frosted glass backdrop */
        background: rgba(0, 0, 0, 0.45);
        backdrop-filter: blur(20px) saturate(180%);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
        animation: ia-fade-in 0.18s ease forwards;
      }

      @keyframes ia-fade-in {
        from { opacity: 0; }
        to   { opacity: 1; }
      }

      @keyframes ia-spring-in {
        0%   { opacity: 0;   transform: scale(0.85); }
        60%  { opacity: 1;   transform: scale(1.03); }
        80%  {               transform: scale(0.98); }
        100% {               transform: scale(1);    }
      }

      @keyframes ia-spring-out {
        from { opacity: 1; transform: scale(1);    }
        to   { opacity: 0; transform: scale(0.88); }
      }

      .ia-box {
        width: min(270px, 72vw);
        background: rgba(242, 242, 247, 0.97);
        border-radius: 14px;
        overflow: hidden;
        font-family: -apple-system, 'SF Pro Display', 'Helvetica Neue', sans-serif;
        box-shadow:
          0 0 0 0.5px rgba(0,0,0,0.18),
          0 20px 60px rgba(0,0,0,0.35),
          0 4px 16px rgba(0,0,0,0.2);
        animation: ia-spring-in 0.38s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      }

      .ia-box.ia-closing {
        animation: ia-spring-out 0.18s ease forwards;
      }

      .ia-body {
        padding: 20px 16px 0;
        text-align: center;
      }

      .ia-title {
        font-size: 17px;
        font-weight: 700;
        color: #000000;
        letter-spacing: -0.2px;
        line-height: 1.3;
        margin: 0 0 4px;
      }

      .ia-message {
        font-size: 13px;
        font-weight: 400;
        color: #3c3c43;
        line-height: 1.4;
        margin: 0 0 16px;
      }

      .ia-input {
        width: 100%;
        box-sizing: border-box;
        background: white;
        border: 1px solid rgba(60, 60, 67, 0.15);
        border-radius: 8px;
        padding: 10px 12px;
        font-size: 14px;
        font-family: inherit;
        color: #000;
        outline: none;
        margin-bottom: 14px;
        transition: border-color 0.15s;
      }

      .ia-input::placeholder { color: #aeaeb2; }
      .ia-input:focus { border-color: #007AFF; }

      .ia-divider-h {
        height: 0.5px;
        background: rgba(60, 60, 67, 0.25);
      }

      .ia-divider-v {
        width: 0.5px;
        background: rgba(60, 60, 67, 0.25);
        flex-shrink: 0;
      }

      .ia-btn-row {
        display: flex;
        flex-direction: row;
        min-height: 44px;
      }

      .ia-btn-row.ia-stacked {
        flex-direction: column;
      }

      .ia-btn {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 12px 8px;
        background: none;
        border: none;
        cursor: pointer;
        font-family: inherit;
        font-size: 17px;
        font-weight: 400;
        color: #007AFF;
        letter-spacing: -0.2px;
        transition: background 0.1s;
        -webkit-tap-highlight-color: transparent;
      }

      .ia-btn:active {
        background: rgba(0, 0, 0, 0.06);
      }

      .ia-btn.ia-cancel {
        font-weight: 600;
        color: #007AFF;
      }

      .ia-btn.ia-destructive {
        font-weight: 400;
        color: #FF3B30;
      }

      .ia-stacked .ia-btn {
        width: 100%;
        flex: unset;
      }

      /* ── Toast ── */
      .ia-toast-host {
        position: fixed;
        bottom: 40px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 999999;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        pointer-events: none;
      }

      .ia-toast {
        background: rgba(40, 40, 40, 0.92);
        backdrop-filter: blur(16px) saturate(180%);
        -webkit-backdrop-filter: blur(16px) saturate(180%);
        color: white;
        font-family: -apple-system, 'SF Pro Display', 'Helvetica Neue', sans-serif;
        font-size: 13px;
        font-weight: 500;
        padding: 10px 20px;
        border-radius: 100px;
        letter-spacing: -0.1px;
        white-space: nowrap;
        pointer-events: auto;
        animation: ia-toast-in 0.3s cubic-bezier(0.34, 1.4, 0.64, 1) forwards;
      }

      @keyframes ia-toast-in {
        from { opacity: 0; transform: translateY(10px) scale(0.95); }
        to   { opacity: 1; transform: translateY(0)    scale(1);    }
      }

      @keyframes ia-toast-out {
        from { opacity: 1; transform: translateY(0)   scale(1);    }
        to   { opacity: 0; transform: translateY(8px) scale(0.95); }
      }

      .ia-toast.ia-toast-hiding {
        animation: ia-toast-out 0.22s ease forwards;
      }
    `;

    const style = document.createElement('style');
    style.id    = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  };

  // ─── Core renderer ────────────────────────────────────────────
  const _show = ({
    title,
    message   = '',
    buttons   = [{ text: 'OK', style: 'default' }],
    type      = 'alert',       // 'alert' | 'prompt'
    secure    = false,
    placeholder = '',
    resolve   = null,          // for Promise-based calls
  }) => {
    injectStyles();

    const backdrop = document.createElement('div');
    backdrop.className = 'ia-backdrop';

    const isHorizontal = buttons.length === 2;

    backdrop.innerHTML = `
      <div class="ia-box" id="__ia_box__">
        <div class="ia-body">
          <p class="ia-title">${title}</p>
          ${message ? `<p class="ia-message">${message}</p>` : ''}
          ${type === 'prompt' ? `
            <input
              class="ia-input"
              id="__ia_input__"
              type="${secure ? 'password' : 'text'}"
              placeholder="${placeholder}"
              autocomplete="off"
            />
          ` : ''}
        </div>
        <div class="ia-divider-h"></div>
        <div class="ia-btn-row ${isHorizontal ? '' : 'ia-stacked'}" id="__ia_btns__"></div>
      </div>
    `;

    document.body.appendChild(backdrop);

    // Focus input if prompt
    if (type === 'prompt') {
      setTimeout(() => backdrop.querySelector('#__ia_input__')?.focus(), 80);
    }

    const box     = backdrop.querySelector('#__ia_box__');
    const btnRow  = backdrop.querySelector('#__ia_btns__');

    // Close helper with spring-out animation
    const close = (value) => {
      box.classList.add('ia-closing');
      backdrop.style.animation = 'ia-fade-in 0.18s ease reverse forwards';
      setTimeout(() => {
        backdrop.remove();
        if (resolve) resolve(value);
      }, 160);
    };

    // Build buttons
    buttons.forEach((btn, idx) => {
      if (isHorizontal && idx > 0) {
        const div = document.createElement('div');
        div.className = 'ia-divider-v';
        btnRow.appendChild(div);
      }
      if (!isHorizontal && idx > 0) {
        const div = document.createElement('div');
        div.className = 'ia-divider-h';
        btnRow.appendChild(div);
      }

      const el = document.createElement('button');
      el.className = [
        'ia-btn',
        btn.style === 'cancel'      ? 'ia-cancel'      : '',
        btn.style === 'destructive' ? 'ia-destructive' : '',
      ].join(' ').trim();
      el.textContent = btn.text;

      el.addEventListener('click', () => {
        const inputVal = backdrop.querySelector('#__ia_input__')?.value || '';
        close(type === 'prompt' ? inputVal : (btn.resolveValue ?? btn.text));
        if (type === 'prompt') {
          setTimeout(() => btn.onPress?.(inputVal), 200);
        } else {
          setTimeout(() => btn.onPress?.(), 200);
        }
      });

      btnRow.appendChild(el);
    });

    // Enter key on prompt
    backdrop.querySelector('#__ia_input__')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const okBtn = buttons.find(b => b.style !== 'cancel');
        const inputVal = backdrop.querySelector('#__ia_input__')?.value || '';
        close(inputVal);
        setTimeout(() => okBtn?.onPress?.(inputVal), 200);
      }
    });
  };

  // ─── Public API (mirrors CustomAlert.tsx) ────────────────────

  /**
   * IosAlert.alert(title, message?, buttons?)
   * Same signature as React Native Alert.alert
   */
  const alert = (title, message, buttons) => {
    _show({
      title,
      message,
      buttons: buttons || [{ text: 'OK', style: 'default' }],
      type: 'alert',
    });
  };

  /**
   * IosAlert.prompt(title, message?, callback?, type?, placeholder?)
   * Same signature as React Native Alert.prompt
   */
  const prompt = (title, message, callback, type, placeholder) => {
    _show({
      title,
      message,
      type:    'prompt',
      secure:  type === 'secure-text',
      placeholder: placeholder || '',
      buttons: [
        { text: 'Cancel', style: 'cancel',  onPress: () => {} },
        { text: 'OK',     style: 'default', onPress: (val) => callback?.(val || '') },
      ],
    });
  };

  /**
   * IosAlert.confirm(title, message?) → Promise<boolean>
   * Bonus helper — await-able confirm dialog
   */
  const confirm = (title, message) => {
    return new Promise((resolve) => {
      _show({
        title,
        message,
        type: 'alert',
        resolve,
        buttons: [
          { text: 'Cancel',  style: 'cancel',      onPress: () => {}, resolveValue: false },
          { text: 'Confirm', style: 'destructive',  onPress: () => {}, resolveValue: true  },
        ],
      });
    });
  };

  /**
   * IosAlert.toast(message, duration?)
   * Subtle pill toast — same feel as iOS HUD
   */
  const toast = (message, duration = 2500) => {
    injectStyles();

    let host = document.getElementById('__ia_toast_host__');
    if (!host) {
      host = document.createElement('div');
      host.id = '__ia_toast_host__';
      host.className = 'ia-toast-host';
      document.body.appendChild(host);
    }

    const t = document.createElement('div');
    t.className   = 'ia-toast';
    t.textContent = message;
    host.appendChild(t);

    setTimeout(() => {
      t.classList.add('ia-toast-hiding');
      setTimeout(() => t.remove(), 220);
    }, duration);
  };

  return { alert, prompt, confirm, toast };

})();

// Support both ES module and plain <script> tag
if (typeof module !== 'undefined' && module.exports) {
  module.exports = IosAlert;
} else if (typeof window !== 'undefined') {
  window.IosAlert = IosAlert;
}