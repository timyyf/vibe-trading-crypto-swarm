# Vibe-Trading Swarm AI Architecture & Performance Optimization

## Overview
This application implements an institutional-grade multi-agent quantitative committee inspired by the **HKU Data Science Vibe-Trading** research framework and Wall Street quantitative trading desks.

---

## 🚀 Execution Speed & Response Optimization

To solve high-latency bottlenecks while retaining ultra-high analytical precision:

1. **Sub-Second LLM Engine**: Powered by `gemini-2.5-flash` configured with structured JSON outputs (`responseMimeType: 'application/json'`).
2. **Asynchronous Parallel Data Pipeline**: Real-time orderbook, candle metrics (EMA20, SMA50, RSI 14), and on-chain sentiment are aggregated concurrently prior to model synthesis.
3. **Non-Blocking UI Stepper**: Front-end step feedback runs on a synchronized 180ms tick rate for instantaneous user responsiveness.

---

## 🤖 The 4 Specialized Agents

Each agent in the committee holds a dedicated quantitative role:

1. **Dr. Quant Graph** *(Chief Technical Officer & Quantitative Chartist)*
   - **Focus**: EMA20, SMA50, RSI(14), Bollinger Bands, Support/Resistance levels.
   - **Methodology**: Technical breakdown of 5-minute candle structures.

2. **Sofia Sentiment** *(Head of Sentiment & Alternative Data)*
   - **Focus**: Reddit (r/CryptoCurrency), news feed sentiment, Fear & Greed Index, orderbook buy/sell imbalance.
   - **Methodology**: Alternative data sentiment score (0–100).

3. **Whale Tracker Apex** *(On-Chain & Institutional Liquidity Director)*
   - **Focus**: Exchange Netflow (Binance/Coinbase), whale alerts (> $100k blocks), cold wallet storage trends.
   - **Methodology**: Institutional order flow and liquidity delta.

4. **Alpha Zoo Engine** *(Head of Quantitative Factors & Statistical Arbitrage)*
   - **Focus**: HKU Vibe-Trading factor library (GTJA-191, Alpha101, Momentum-Volatility).
   - **Methodology**: Historical backtest IC (Information Coefficient) & Sharpe ratio validation.

---

## ⏱️ Autonomous Safe Operational Window (5, 10, 15 ou 20 Minutos)

- **Dynamic Validity Countdown (5, 10, 15, 20 min)**: The 4 senior agents evaluate orderbook depth, RSI momentum, and volume flow to dynamically select or extend the safe operation window (5, 10, 15, or 20 minutes) backed by solid technical justification.
- **Entry Recalibration ("Entrei no Trade Agora")**: Locks the exact entry timestamp whether the user executes immediately or minutes after analysis, automatically computing the exact safe window from that execution point.
- **Autonomous Auto-Extension (+5m)**: Allows extending the operational window (+5 min) when ongoing volume and trend indicators confirm sustained safety.

---

## 🛠️ Verification & Compilation
Built and tested with Vite, Express, and Google Gemini API integration.
