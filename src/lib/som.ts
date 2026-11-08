let contexto: AudioContext | null = null;

function obterContexto() {
  if (contexto) return contexto;
  const janela = window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };
  const Construtor = window.AudioContext ?? janela.webkitAudioContext;
  if (!Construtor) return null;
  contexto = new Construtor();
  return contexto;
}

/** Deve ser chamado a partir de um clique/toque para liberar o áudio do navegador. */
export function prepararSom() {
  const atual = obterContexto();
  if (atual?.state === 'suspended') void atual.resume();
}

export function tocarSomNotificacao() {
  const atual = obterContexto();
  if (!atual) return;
  const tocar = () => {
    const agora = atual.currentTime;
    [0, 0.14].forEach((atraso, indice) => {
      const oscilador = atual.createOscillator();
      const ganho = atual.createGain();
      oscilador.type = 'sine';
      oscilador.frequency.value = indice ? 880 : 660;
      ganho.gain.setValueAtTime(0.0001, agora + atraso);
      ganho.gain.exponentialRampToValueAtTime(0.16, agora + atraso + 0.015);
      ganho.gain.exponentialRampToValueAtTime(0.0001, agora + atraso + 0.12);
      oscilador.connect(ganho).connect(atual.destination);
      oscilador.start(agora + atraso);
      oscilador.stop(agora + atraso + 0.13);
    });
  };
  if (atual.state === 'suspended') void atual.resume().then(tocar).catch(() => undefined);
  else tocar();
}
