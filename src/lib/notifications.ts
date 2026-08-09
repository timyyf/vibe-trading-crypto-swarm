import { SwarmAnalysisResult } from '../types';

export const STRONG_SIGNAL_THRESHOLD = 0.75;

export const isStrongSignal = (result: SwarmAnalysisResult): boolean =>
  result.finalDecision !== 'AGUARDAR / NEUTRO' && result.confidenceScore >= STRONG_SIGNAL_THRESHOLD;

export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission === 'default') {
    try {
      return await Notification.requestPermission();
    } catch (err) {
      console.warn('Falha ao solicitar permissão de notificação:', err);
      return 'denied';
    }
  }
  return Notification.permission;
};

export const showSignalNotification = (result: SwarmAnalysisResult): void => {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const direction = result.finalDecision === 'COMPRAR' ? '▲ COMPRAR' : '▼ VENDER';
  try {
    new Notification(`Sinal ${direction} ${result.assetSymbol}`, {
      body: `Confiança ${(result.confidenceScore * 100).toFixed(0)}% — Entrada $${result.entryTarget.toFixed(2)} | TP $${result.takeProfit.toFixed(2)} | SL $${result.stopLoss.toFixed(2)}`,
      icon: '/icon.svg',
      tag: `signal-${result.assetSymbol}-${result.finalDecision}-${result.entryTarget.toFixed(2)}`,
    });
  } catch (err) {
    console.warn('Falha ao exibir notificação:', err);
  }
};
