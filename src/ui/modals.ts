/**
 * 轻量弹窗系统：backdrop + 卡片，一次只开一个。
 */
export interface ModalHandle {
  close(): void;
  el: HTMLElement;
}

let current: ModalHandle | null = null;

export function openModal(title: string, body: HTMLElement | string): ModalHandle {
  current?.close();

  const host = document.getElementById('modals');
  if (!host) throw new Error('找不到 #modals');

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `<h2>${title}</h2><button class="modal-close" aria-label="关闭">✕</button>`;
  if (typeof body === 'string') {
    const div = document.createElement('div');
    div.innerHTML = body;
    modal.appendChild(div);
  } else {
    modal.appendChild(body);
  }

  host.appendChild(backdrop);
  host.appendChild(modal);

  const handle: ModalHandle = {
    el: modal,
    close() {
      backdrop.remove();
      modal.remove();
      if (current === handle) current = null;
    },
  };
  current = handle;

  backdrop.addEventListener('click', () => handle.close());
  modal.querySelector('.modal-close')?.addEventListener('click', () => handle.close());
  return handle;
}
