window.TVChart = window.TVChart || {};

    (function (TV) {
      const STORAGE_KEY = "tv_pro_chart_v9";

      const SYMBOLS = [
        { id: "BTCUSDT", label: "Bitcoin / U.S. Dollar", short: "BTCUSDT", base: "BTC", icon: "₿", color: "#f7931a", decimals: 1 },
        { id: "ETHUSDT", label: "Ethereum / U.S. Dollar", short: "ETHUSDT", base: "ETH", icon: "Ξ", color: "#627eea", decimals: 2 },
        { id: "SOLUSDT", label: "Solana / U.S. Dollar", short: "SOLUSDT", base: "SOL", icon: "◎", color: "#14f195", decimals: 2 },
        { id: "BNBUSDT", label: "BNB / U.S. Dollar", short: "BNBUSDT", base: "BNB", icon: "◆", color: "#f3ba2f", decimals: 2 }
      ];

      const TIMEFRAMES = ["1m", "3m", "5m", "15m", "30m", "1h", "4h"];

      function getDefaults() {
        return {
          symbol: "BTCUSDT",
          timeframe: "1m",
          cleanMode: false,
          showHiLoLines: true,
          showTradeLines: true,
          btcFlow: {
            enabled: true,
            mode: "TAKER",
            showLabels: true,
            showSplitVol: true,
            minVol: 0,
            minDomPct: 50,
            decimals: 2,
            fontSize: 9,
            buyColor: "#089981",
            sellColor: "#f23645"
          },
          absCvd: {
            enabled: true,
            showMarkers: true,
            showHalo: true,
            showSubPane: true,
            volMult: 1.4,
            smaLen: 20,
            minDeltaPct: 12,
            rsiFilter: true,
            rsiOb: 65,
            rsiOs: 35,
            wickRatio: 0.35,
            cvdColor: "#2962ff",
            bullColor: "#00e676",
            bearColor: "#ff1744"
          },
          rsi: {
            enabled: true,
            period: 14,
            maPeriod: 14,
            showMa: true,
            ob: 70,
            os: 30,
            lineColor: "#ab47bc",
            maColor: "#ffb74d"
          },
          vwapEma: {
            enabled: true,
            showVwap: true,
            showBands: false,
            showEmaFast: true,
            showEmaSlow: true,
            emaFast: 20,
            emaSlow: 50,
            vwapColor: "#ffb300",
            fastColor: "#29b6f6",
            slowColor: "#ef5350"
          },
          srLevels: {
            enabled: true,
            pivotLen: 6,
            maxZones: 4,
            zonePct: 0.12,
            showLabels: true,
            supColor: "#089981",
            resColor: "#f23645"
          },
          macd: {
            enabled: false,
            fast: 12,
            slow: 26,
            signal: 9,
            macdColor: "#2962ff",
            sigColor: "#ff9800"
          },
          structure: {
            enabled: true,
            swingLen: 4,
            showSwings: true,
            showBos: true,
            bullColor: "#26a69a",
            bearColor: "#ef5350"
          },
          smcPro: {
            enabled: true,
            swingLen: 4,
            showChoch: true,
            showLiq: true,
            showSweeps: true,
            showOb: true,
            showEntries: true,
            eqTolPct: 0.05,
            maxLiq: 4,
            maxOb: 3
          },
          patterns: {
            enabled: true,
            swingLen: 3,
            showWM: true,
            showTriangles: true,
            showHS: true,
            showTargets: true,
            maxPatterns: 3
          },
          mtfMacd: {
            enabled: true,
            fast: 12,
            slow: 26,
            signal: 9,
            slopeLen: 2,
            angleScale: 1.8,
            imminentDist: 22,
            imminentEta: 5.5,
            minAngle: 7,
            dualAngle: 8,
            accelFilter: true,
            showBottomStrip: true,
            showChartMarkers: true
          }
        };
      }

      function deepMerge(target, source) {
        if (!source || typeof source !== "object") return target;
        const out = Array.isArray(target) ? target.slice() : Object.assign({}, target);
        Object.keys(source).forEach((k) => {
          if (k in target) {
            if (target[k] && typeof target[k] === "object" && !Array.isArray(target[k])) {
              out[k] = deepMerge(target[k], source[k]);
            } else if (typeof source[k] === typeof target[k]) {
              out[k] = source[k];
            }
          }
        });
        return out;
      }

      const ConfigStore = {
        SYMBOLS,
        TIMEFRAMES,
        data: getDefaults(),
        listeners: [],

        load() {
          try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) this.data = deepMerge(getDefaults(), JSON.parse(raw));
            else this.data = getDefaults();
          } catch (e) {
            this.data = getDefaults();
          }
          return this.data;
        },

        save() {
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data)); } catch (e) {}
          this.notify();
        },

        resetSection(sectionKey) {
          const def = getDefaults();
          if (sectionKey && sectionKey in def) {
            this.data[sectionKey] = JSON.parse(JSON.stringify(def[sectionKey]));
          } else {
            this.data = def;
          }
          this.save();
        },

        getSymbolMeta(symId) {
          return SYMBOLS.find((s) => s.id === (symId || this.data.symbol)) || SYMBOLS[0];
        },

        subscribe(fn) { this.listeners.push(fn); },
        notify() { this.listeners.forEach((fn) => { try { fn(this.data); } catch (e) {} }); }
      };

      TV.ConfigStore = ConfigStore;
    })(window.TVChart);

(function (TV) {
      const REST_BASES = [
        "https://data-api.binance.vision",
        "https://api.binance.com",
        "https://api1.binance.com",
        "https://api3.binance.com"
      ];

      const WS_BASES = [
        "wss://stream.binance.com:9443/stream?streams=",
        "wss://data-stream.binance.vision/stream?streams="
      ];

      function parseKline(k) {
        const o = parseFloat(k[1]), h = parseFloat(k[2]), l = parseFloat(k[3]), c = parseFloat(k[4]), v = parseFloat(k[5]);
        const takerBuy = parseFloat(k[9]) || 0;
        const takerSell = Math.max(0, v - takerBuy);
        const ratio = h === l ? (c >= o ? 0.6 : 0.4) : (c - l) / (h - l);
        const tickBuy = v * Math.max(0.05, Math.min(0.95, ratio));
        return {
          time: Number(k[0]),
          closeTime: Number(k[6]),
          open: o, high: h, low: l, close: c, volume: v,
          takerBuy, takerSell,
          tickBuy, tickSell: Math.max(0, v - tickBuy),
          liveAggActive: false
        };
      }

      class DataEngine {
        constructor(callbacks) {
          this.cb = callbacks || {};
          this.candles = [];
          this.symbol = "BTCUSDT";
          this.timeframe = "1m";
          this.ws = null;
          this.wsIndex = 0;
          this.reconnectTimer = null;
          this.loadingMore = false;
          this.lastTickPrice = null;
          this.destroyed = false;
        }

        async fetchWithFallback(path) {
          let lastErr = null;
          for (let i = 0; i < REST_BASES.length; i++) {
            try {
              const ctrl = new AbortController();
              const timer = setTimeout(() => ctrl.abort(), 8000);
              const res = await fetch(REST_BASES[i] + path, { signal: ctrl.signal });
              clearTimeout(timer);
              if (res.ok) return await res.json();
              lastErr = new Error("HTTP " + res.status);
            } catch (err) {
              lastErr = err;
            }
          }
          throw lastErr || new Error("Binance REST failed");
        }

        async loadSymbol(symbol, timeframe) {
          this.symbol = symbol;
          this.timeframe = timeframe;
          this.closeWs();
          this.lastTickPrice = null;
          if (this.cb.onStatus) this.cb.onStatus("loading", `Loading ${symbol} ${timeframe}…`);

          try {
            const raw = await this.fetchWithFallback(`/api/v3/klines?symbol=${symbol}&interval=${timeframe}&limit=500`);
            this.candles = raw.map(parseKline);
            if (this.cb.onData) this.cb.onData(this.candles, true);
            if (this.cb.onStatus) this.cb.onStatus("live", "");
            this.connectWs();
          } catch (err) {
            if (this.cb.onStatus) this.cb.onStatus("err", "Connection error — retrying…");
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = setTimeout(() => this.loadSymbol(symbol, timeframe), 3500);
          }
        }

        async loadOlder() {
          if (this.loadingMore || !this.candles.length) return 0;
          this.loadingMore = true;
          try {
            const firstTime = this.candles[0].time;
            const raw = await this.fetchWithFallback(
              `/api/v3/klines?symbol=${this.symbol}&interval=${this.timeframe}&endTime=${firstTime - 1}&limit=250`
            );
            const older = raw.map(parseKline).filter((c) => c.time < firstTime);
            if (older.length) {
              this.candles = older.concat(this.candles);
              if (this.cb.onOlderData) this.cb.onOlderData(older.length);
            }
            return older.length;
          } catch (e) {
            return 0;
          } finally {
            this.loadingMore = false;
          }
        }

        closeWs() {
          clearTimeout(this.reconnectTimer);
          if (this.ws) {
            try {
              this.ws.onopen = this.ws.onmessage = this.ws.onerror = this.ws.onclose = null;
              this.ws.close();
            } catch (e) {}
            this.ws = null;
          }
        }

        connectWs() {
          this.closeWs();
          const symLower = this.symbol.toLowerCase();
          const streams = `${symLower}@kline_${this.timeframe}/${symLower}@aggTrade`;
          const url = WS_BASES[this.wsIndex % WS_BASES.length] + streams;

          try {
            const ws = new WebSocket(url);
            this.ws = ws;
            ws.onopen = () => { if (this.cb.onStatus) this.cb.onStatus("live", ""); };
            ws.onmessage = (ev) => {
              try {
                const msg = JSON.parse(ev.data);
                if (!msg || !msg.data) return;
                const d = msg.data;
                if (d.e === "kline") this.handleKline(d.k);
                else if (d.e === "aggTrade") this.handleAggTrade(d);
              } catch (e) {}
            };
            ws.onerror = () => { this.wsIndex++; };
            ws.onclose = () => {
              if (this.destroyed) return;
              if (this.cb.onStatus) this.cb.onStatus("loading", "");
              this.wsIndex++;
              clearTimeout(this.reconnectTimer);
              this.reconnectTimer = setTimeout(() => this.connectWs(), 2500);
            };
          } catch (e) {
            this.wsIndex++;
            this.reconnectTimer = setTimeout(() => this.connectWs(), 3000);
          }
        }

        handleKline(k) {
          if (!this.candles.length) return;
          const openTime = Number(k.t);
          const last = this.candles[this.candles.length - 1];
          const o = parseFloat(k.o), h = parseFloat(k.h), l = parseFloat(k.l), c = parseFloat(k.c), v = parseFloat(k.v);
          const takerBuy = parseFloat(k.V) || 0;
          const takerSell = Math.max(0, v - takerBuy);

          if (openTime === last.time) {
            last.open = o; last.high = h; last.low = l; last.close = c; last.volume = v;
            last.closeTime = Number(k.T);
            last.takerBuy = takerBuy; last.takerSell = takerSell;
            if (!last.liveAggActive) { last.tickBuy = takerBuy; last.tickSell = takerSell; }
          } else if (openTime > last.time) {
            this.candles.push({
              time: openTime, closeTime: Number(k.T),
              open: o, high: h, low: l, close: c, volume: v,
              takerBuy, takerSell, tickBuy: takerBuy, tickSell: takerSell, liveAggActive: false
            });
            if (this.candles.length > 1500) this.candles.shift();
          }
          if (this.cb.onTick) this.cb.onTick(this.candles);
        }

        handleAggTrade(t) {
          if (!this.candles.length) return;
          const last = this.candles[this.candles.length - 1];
          const price = parseFloat(t.p), qty = parseFloat(t.q);
          if (!isFinite(price) || !isFinite(qty)) return;
          if (!last.liveAggActive) last.liveAggActive = true;

          if (this.lastTickPrice === null) {
            if (t.m) last.tickSell += qty; else last.tickBuy += qty;
          } else if (price > this.lastTickPrice) {
            last.tickBuy += qty;
          } else if (price < this.lastTickPrice) {
            last.tickSell += qty;
          } else {
            if (t.m) last.tickSell += qty; else last.tickBuy += qty;
          }
          this.lastTickPrice = price;
        }
      }

      TV.DataEngine = DataEngine;
    })(window.TVChart);

(function (TV) {
      function safeRun(fn, fallback) {
        try { return fn(); } catch (e) { return fallback; }
      }

      function calcEMA(values, period) {
        const out = new Array(values.length).fill(null);
        if (values.length < period || period < 1) return out;
        const k = 2 / (period + 1);
        let sum = 0;
        for (let i = 0; i < period; i++) sum += values[i];
        let prev = sum / period;
        out[period - 1] = prev;
        for (let i = period; i < values.length; i++) {
          prev = values[i] * k + prev * (1 - k);
          out[i] = prev;
        }
        return out;
      }

      function calcSMA(values, period) {
        const out = new Array(values.length).fill(null);
        if (period < 1) return out;
        let sum = 0, count = 0;
        for (let i = 0; i < values.length; i++) {
          const v = values[i];
          if (v !== null && isFinite(v)) { sum += v; count++; }
          if (i >= period) {
            const old = values[i - period];
            if (old !== null && isFinite(old)) { sum -= old; count--; }
          }
          if (i >= period - 1 && count === period) out[i] = sum / period;
        }
        return out;
      }

      function calcATR(candles, period) {
        const n = candles.length;
        if (n < 2) return 0;
        const trs = [];
        for (let i = 1; i < n; i++) {
          const c = candles[i], p = candles[i - 1];
          trs.push(Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close)));
        }
        const slice = trs.slice(-Math.min(period || 14, trs.length));
        return slice.reduce((a, b) => a + b, 0) / Math.max(1, slice.length);
      }

      function findSwings(candles, len) {
        const swings = [];
        const n = candles.length;
        if (n < len * 2 + 1) return swings;
        for (let i = len; i < n - len; i++) {
          let isHigh = true, isLow = true;
          const hi = candles[i].high, lo = candles[i].low;
          for (let j = i - len; j <= i + len; j++) {
            if (j === i) continue;
            if (candles[j].high >= hi) isHigh = false;
            if (candles[j].low <= lo) isLow = false;
            if (!isHigh && !isLow) break;
          }
          if (isHigh) swings.push({ idx: i, type: "H", price: hi, time: candles[i].time });
          if (isLow) swings.push({ idx: i, type: "L", price: lo, time: candles[i].time });
        }
        return swings;
      }

      const IndicatorEngine = {
        computeAll(candles, cfg) {
          const res = {
            atr: 0,
            flow: [],
            rsi: { line: [], ma: [] },
            absCvd: { cvd: [], delta: [], signals: [] },
            vwapEma: { vwap: [], upper: [], lower: [], emaFast: [], emaSlow: [] },
            sr: { zones: [] },
            macd: { macd: [], signal: [], hist: [] },
            structure: { swings: [], breaks: [], bias: "NEUTRAL" },
            smcPro: { chochs: [], liqZones: [], sweeps: [], orderBlocks: [], entries: [] },
            patterns: []
          };
          if (!candles || !candles.length) return res;

          res.atr = safeRun(() => calcATR(candles, 14), 0);
          res.flow = safeRun(() => this.calcFlow(candles, cfg.btcFlow), []);
          res.rsi = safeRun(() => this.calcRSI(candles, cfg.rsi), res.rsi);
          res.absCvd = safeRun(() => this.calcAbsCvd(candles, res.flow, res.rsi.line, cfg.absCvd), res.absCvd);
          res.vwapEma = safeRun(() => this.calcVwapEma(candles, cfg.vwapEma), res.vwapEma);
          res.sr = safeRun(() => this.calcSR(candles, cfg.srLevels), res.sr);
          res.macd = safeRun(() => this.calcMACD(candles, cfg.macd), res.macd);
          res.structure = safeRun(() => this.calcStructure(candles, cfg.structure), res.structure);
          res.smcPro = safeRun(() => this.calcSmcPro(candles, cfg.smcPro), res.smcPro);
          res.patterns = safeRun(() => this.calcPatterns(candles, cfg.patterns), []);
          return res;
        },

        calcFlow(candles, cfg) {
          const mode = cfg.mode || "TAKER";
          return candles.map((c) => {
            const buy = mode === "TICK" ? c.tickBuy : c.takerBuy;
            const sell = mode === "TICK" ? c.tickSell : c.takerSell;
            const total = buy + sell;
            const buyPct = total > 0 ? (buy / total) * 100 : 50;
            const sellPct = total > 0 ? (sell / total) * 100 : 50;
            return { buy, sell, total, delta: buy - sell, buyPct, sellPct };
          });
        },

        calcRSI(candles, cfg) {
          const n = candles.length;
          const period = Math.max(2, cfg.period || 14);
          const line = new Array(n).fill(null);
          if (n <= period) return { line, ma: new Array(n).fill(null) };

          let gains = 0, losses = 0;
          for (let i = 1; i <= period; i++) {
            const diff = candles[i].close - candles[i - 1].close;
            if (diff >= 0) gains += diff; else losses -= diff;
          }
          let avgGain = gains / period, avgLoss = losses / period;
          line[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

          for (let i = period + 1; i < n; i++) {
            const diff = candles[i].close - candles[i - 1].close;
            avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
            avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
            line[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
          }
          return { line, ma: calcSMA(line, Math.max(2, cfg.maPeriod || 14)) };
        },

        calcAbsCvd(candles, flow, rsiLine, cfg) {
          const n = candles.length;
          const cvd = new Array(n).fill(0), delta = new Array(n).fill(0);
          const signals = [];
          const volSma = calcSMA(candles.map((c) => c.volume), Math.max(5, cfg.smaLen || 20));

          let running = 0;
          for (let i = 0; i < n; i++) {
            const f = flow[i] || { buy: 0, sell: 0, total: 0, delta: 0 };
            delta[i] = f.delta;
            running += f.delta;
            cvd[i] = running;

            const avgV = volSma[i];
            if (!avgV || avgV <= 0) continue;
            const c = candles[i];
            if (c.volume < avgV * (cfg.volMult || 1.4)) continue;

            const range = Math.max(1e-9, c.high - c.low);
            const lowerWick = (Math.min(c.open, c.close) - c.low) / range;
            const upperWick = (c.high - Math.max(c.open, c.close)) / range;
            const deltaPct = f.total > 0 ? (Math.abs(f.delta) / f.total) * 100 : 0;
            if (deltaPct < (cfg.minDeltaPct || 12)) continue;

            const isGreen = c.close >= c.open;
            const wickThr = cfg.wickRatio || 0.35;

            let rsiAllowBull = true, rsiAllowBear = true;
            if (cfg.rsiFilter) {
              rsiAllowBull = false; rsiAllowBear = false;
              for (let k = Math.max(0, i - 2); k <= i; k++) {
                const rv = rsiLine[k];
                if (rv !== null && rv <= (cfg.rsiOs || 35)) rsiAllowBull = true;
                if (rv !== null && rv >= (cfg.rsiOb || 65)) rsiAllowBear = true;
              }
            }

            if (f.delta < 0 && (isGreen || lowerWick >= wickThr) && rsiAllowBull) {
              signals.push({ idx: i, dir: "bull", price: c.low, cvd: running });
            } else if (f.delta > 0 && (!isGreen || upperWick >= wickThr) && rsiAllowBear) {
              signals.push({ idx: i, dir: "bear", price: c.high, cvd: running });
            }
          }
          return { cvd, delta, signals };
        },

        calcVwapEma(candles, cfg) {
          const n = candles.length;
          const closes = candles.map((c) => c.close);
          const emaFast = calcEMA(closes, Math.max(2, cfg.emaFast || 20));
          const emaSlow = calcEMA(closes, Math.max(2, cfg.emaSlow || 50));
          const vwap = new Array(n).fill(null), upper = new Array(n).fill(null), lower = new Array(n).fill(null);

          let cumPV = 0, cumV = 0, cumPV2 = 0, curDay = -1;
          for (let i = 0; i < n; i++) {
            const c = candles[i];
            const day = Math.floor(c.time / 86400000);
            if (day !== curDay) { cumPV = 0; cumV = 0; cumPV2 = 0; curDay = day; }
            const tp = (c.high + c.low + c.close) / 3;
            const v = Math.max(1e-9, c.volume);
            cumPV += tp * v; cumV += v; cumPV2 += tp * tp * v;
            const mean = cumPV / cumV;
            const std = Math.sqrt(Math.max(0, cumPV2 / cumV - mean * mean));
            vwap[i] = mean; upper[i] = mean + std; lower[i] = mean - std;
          }
          return { vwap, upper, lower, emaFast, emaSlow };
        },

        calcSR(candles, cfg) {
          const swings = findSwings(candles, Math.max(3, cfg.pivotLen || 6));
          if (!swings.length) return { zones: [] };
          const lastClose = candles[candles.length - 1].close;
          const tol = lastClose * ((cfg.zonePct || 0.12) / 100);
          const clusters = [];

          swings.forEach((s) => {
            let matched = clusters.find((cl) => Math.abs(cl.mid - s.price) <= tol * 2.2);
            if (matched) {
              matched.touches++;
              matched.min = Math.min(matched.min, s.price);
              matched.max = Math.max(matched.max, s.price);
              matched.mid = (matched.min + matched.max) / 2;
              matched.lastIdx = Math.max(matched.lastIdx, s.idx);
            } else {
              clusters.push({ mid: s.price, min: s.price - tol * 0.5, max: s.price + tol * 0.5, touches: 1, lastIdx: s.idx });
            }
          });

          clusters.sort((a, b) => b.touches - a.touches || b.lastIdx - a.lastIdx);
          return {
            zones: clusters.slice(0, Math.max(1, cfg.maxZones || 4)).map((z) => ({
              min: z.min, max: z.max, mid: z.mid, touches: z.touches, type: z.mid >= lastClose ? "R" : "S"
            }))
          };
        },

        calcMACD(candles, cfg) {
          const closes = candles.map((c) => c.close);
          const fast = calcEMA(closes, Math.max(2, cfg.fast || 12));
          const slow = calcEMA(closes, Math.max(3, cfg.slow || 26));
          const macd = closes.map((_, i) => (fast[i] !== null && slow[i] !== null ? fast[i] - slow[i] : null));
          const validStart = macd.findIndex((v) => v !== null);
          const sig = new Array(candles.length).fill(null);
          if (validStart !== -1) {
            const subSig = calcEMA(macd.slice(validStart), Math.max(2, cfg.signal || 9));
            for (let i = 0; i < subSig.length; i++) sig[validStart + i] = subSig[i];
          }
          const hist = macd.map((m, i) => (m !== null && sig[i] !== null ? m - sig[i] : null));
          return { macd, signal: sig, hist };
        },

        calcStructure(candles, cfg) {
          const raw = findSwings(candles, Math.max(2, cfg.swingLen || 4));
          const labeled = [];
          let lastH = null, lastL = null, bias = "NEUTRAL";
          const breaks = [];

          raw.forEach((s) => {
            if (s.type === "H") {
              labeled.push({ idx: s.idx, type: "H", price: s.price, tag: !lastH ? "H" : s.price > lastH.price ? "HH" : "LH" });
              lastH = s;
            } else {
              labeled.push({ idx: s.idx, type: "L", price: s.price, tag: !lastL ? "L" : s.price > lastL.price ? "HL" : "LL" });
              lastL = s;
            }
          });

          let activeHigh = null, activeLow = null, swPtr = 0;
          for (let i = 0; i < candles.length; i++) {
            while (swPtr < raw.length && raw[swPtr].idx + (cfg.swingLen || 4) <= i) {
              const sw = raw[swPtr];
              if (sw.type === "H") activeHigh = { idx: sw.idx, price: sw.price, broken: false };
              else activeLow = { idx: sw.idx, price: sw.price, broken: false };
              swPtr++;
            }
            const c = candles[i];
            if (activeHigh && !activeHigh.broken && c.close > activeHigh.price) {
              activeHigh.broken = true;
              const kind = bias === "BEARISH" ? "CHoCH" : "BOS";
              bias = "BULLISH";
              breaks.push({ fromIdx: activeHigh.idx, toIdx: i, price: activeHigh.price, dir: "bull", kind });
            }
            if (activeLow && !activeLow.broken && c.close < activeLow.price) {
              activeLow.broken = true;
              const kind = bias === "BULLISH" ? "CHoCH" : "BOS";
              bias = "BEARISH";
              breaks.push({ fromIdx: activeLow.idx, toIdx: i, price: activeLow.price, dir: "bear", kind });
            }
          }
          return { swings: labeled, breaks: breaks.slice(-14), bias };
        },

        calcSmcPro(candles, cfg) {
          const len = Math.max(2, cfg.swingLen || 4);
          const swings = findSwings(candles, len);
          const chochs = [], liqZones = [], sweeps = [], orderBlocks = [], entries = [];
          const n = candles.length;
          if (n < 15) return { chochs, liqZones, sweeps, orderBlocks, entries };

          let trend = "NEUTRAL", swingH = null, swingL = null, swPtr = 0;
          for (let i = 0; i < n; i++) {
            while (swPtr < swings.length && swings[swPtr].idx + len <= i) {
              const sw = swings[swPtr];
              if (sw.type === "H") swingH = { idx: sw.idx, price: sw.price, broken: false };
              else swingL = { idx: sw.idx, price: sw.price, broken: false };
              swPtr++;
            }
            const c = candles[i];
            if (swingH && !swingH.broken && c.close > swingH.price) {
              swingH.broken = true;
              if (trend === "BEARISH") {
                chochs.push({ fromIdx: swingH.idx, toIdx: i, price: swingH.price, dir: "bull" });
                for (let k = i - 1; k >= Math.max(0, i - 12); k--) {
                  if (candles[k].close < candles[k].open) {
                    orderBlocks.push({ idx: k, top: candles[k].high, bottom: candles[k].low, dir: "bull", mitigatedIdx: null });
                    break;
                  }
                }
              }
              trend = "BULLISH";
            }
            if (swingL && !swingL.broken && c.close < swingL.price) {
              swingL.broken = true;
              if (trend === "BULLISH") {
                chochs.push({ fromIdx: swingL.idx, toIdx: i, price: swingL.price, dir: "bear" });
                for (let k = i - 1; k >= Math.max(0, i - 12); k--) {
                  if (candles[k].close > candles[k].open) {
                    orderBlocks.push({ idx: k, top: candles[k].high, bottom: candles[k].low, dir: "bear", mitigatedIdx: null });
                    break;
                  }
                }
              }
              trend = "BEARISH";
            }
          }

          orderBlocks.forEach((ob) => {
            for (let j = ob.idx + 3; j < n; j++) {
              const c = candles[j];
              if (ob.dir === "bull" && c.low <= ob.top && c.close >= ob.bottom) {
                if (c.close > c.open && ob.mitigatedIdx === null) entries.push({ idx: j, dir: "bull", price: c.low, reason: "OB" });
                ob.mitigatedIdx = j; break;
              }
              if (ob.dir === "bear" && c.high >= ob.bottom && c.close <= ob.top) {
                if (c.close < c.open && ob.mitigatedIdx === null) entries.push({ idx: j, dir: "bear", price: c.high, reason: "OB" });
                ob.mitigatedIdx = j; break;
              }
            }
          });

          const eqTol = (cfg.eqTolPct || 0.05) / 100;
          const highs = swings.filter((s) => s.type === "H").slice(-16);
          const lows = swings.filter((s) => s.type === "L").slice(-16);

          const buildLiq = (list, side) => {
            const used = new Set();
            for (let i = list.length - 1; i >= 0; i--) {
              if (used.has(i)) continue;
              const a = list[i];
              let isEq = false, startIdx = a.idx, price = a.price;
              for (let j = i - 1; j >= 0; j--) {
                const b = list[j];
                if (Math.abs(a.price - b.price) / a.price <= eqTol) {
                  isEq = true; used.add(j); startIdx = b.idx;
                  price = side === "BSL" ? Math.max(a.price, b.price) : Math.min(a.price, b.price);
                  break;
                }
              }
              let sweptIdx = null;
              for (let k = a.idx + 2; k < n; k++) {
                const c = candles[k];
                if (side === "BSL" && c.high > price) {
                  sweptIdx = k;
                  if (c.close < price) {
                    sweeps.push({ idx: k, dir: "bear", price: c.high });
                    if (c.close < c.open) entries.push({ idx: k, dir: "bear", price: c.high, reason: "SWEEP" });
                  }
                  break;
                }
                if (side === "SSL" && c.low < price) {
                  sweptIdx = k;
                  if (c.close > price) {
                    sweeps.push({ idx: k, dir: "bull", price: c.low });
                    if (c.close > c.open) entries.push({ idx: k, dir: "bull", price: c.low, reason: "SWEEP" });
                  }
                  break;
                }
              }
              if (sweptIdx === null || sweptIdx > n - 35) {
                liqZones.push({
                  side,
                  label: isEq ? (side === "BSL" ? "$$$ EQH" : "$$$ EQL") : (side === "BSL" ? "$$$ BSL" : "$$$ SSL"),
                  price, startIdx, endIdx: sweptIdx !== null ? sweptIdx : n - 1, swept: sweptIdx !== null
                });
              }
            }
          };

          buildLiq(highs, "BSL");
          buildLiq(lows, "SSL");

          const entryMap = new Map();
          entries.forEach((e) => entryMap.set(e.idx + "_" + e.dir, e));

          return {
            chochs: chochs.slice(-8),
            liqZones: liqZones.slice(0, Math.max(2, (cfg.maxLiq || 4) * 2)),
            sweeps: sweeps.slice(-8),
            orderBlocks: orderBlocks.slice(-(cfg.maxOb || 3)),
            entries: Array.from(entryMap.values()).slice(-6)
          };
        },

        calcPatterns(candles, cfg) {
          const patterns = [];
          const n = candles.length;
          if (n < 25) return patterns;

          const raw = findSwings(candles, Math.max(2, cfg.swingLen || 3));
          const pivots = [];
          raw.forEach((p) => {
            if (!pivots.length) { pivots.push(p); return; }
            const prev = pivots[pivots.length - 1];
            if (prev.type === p.type) {
              if ((p.type === "H" && p.price > prev.price) || (p.type === "L" && p.price < prev.price)) pivots[pivots.length - 1] = p;
            } else pivots.push(p);
          });

          const recent = pivots.slice(-14);
          const lastClose = candles[n - 1].close;

          if (cfg.showWM && recent.length >= 3) {
            for (let i = recent.length - 3; i >= 0; i--) {
              const p1 = recent[i], p2 = recent[i + 1], p3 = recent[i + 2];
              if (n - p3.idx > 65) break;
              if (p1.type === "L" && p2.type === "H" && p3.type === "L") {
                const diff = Math.abs(p1.price - p3.price) / p1.price;
                const height = p2.price - Math.min(p1.price, p3.price);
                if (diff <= 0.0045 && height > 0) {
                  const confirmed = lastClose > p2.price;
                  patterns.push({ kind: "WM", name: confirmed ? "W Double Bottom" : "Forming W", dir: "bull", confirmed, points: [p1, p2, p3], neckline: p2.price, target: p2.price + height });
                  break;
                }
              }
              if (p1.type === "H" && p2.type === "L" && p3.type === "H") {
                const diff = Math.abs(p1.price - p3.price) / p1.price;
                const height = Math.max(p1.price, p3.price) - p2.price;
                if (diff <= 0.0045 && height > 0) {
                  const confirmed = lastClose < p2.price;
                  patterns.push({ kind: "WM", name: confirmed ? "M Double Top" : "Forming M", dir: "bear", confirmed, points: [p1, p2, p3], neckline: p2.price, target: p2.price - height });
                  break;
                }
              }
            }
          }

          if (cfg.showTriangles && recent.length >= 4) {
            const p = recent.slice(-4);
            const highs = p.filter((x) => x.type === "H"), lows = p.filter((x) => x.type === "L");
            if (highs.length === 2 && lows.length === 2 && n - p[3].idx <= 55) {
              const hSlope = (highs[1].price - highs[0].price) / Math.max(1, highs[1].idx - highs[0].idx);
              const lSlope = (lows[1].price - lows[0].price) / Math.max(1, lows[1].idx - lows[0].idx);
              const spanStart = Math.abs(highs[0].price - lows[0].price), spanEnd = Math.abs(highs[1].price - lows[1].price);
              if (spanEnd < spanStart * 0.92 && spanEnd > 0) {
                let name = "Sym Triangle", dir = "neutral";
                if (Math.abs(hSlope) < Math.abs(lSlope) * 0.25 && lSlope > 0) { name = "Asc Triangle"; dir = "bull"; }
                else if (Math.abs(lSlope) < Math.abs(hSlope) * 0.25 && hSlope < 0) { name = "Desc Triangle"; dir = "bear"; }
                else if (hSlope > 0 && lSlope > 0) { name = "Rising Wedge"; dir = "bear"; }
                else if (hSlope < 0 && lSlope < 0) { name = "Falling Wedge"; dir = "bull"; }
                patterns.push({ kind: "TRI", name, dir, confirmed: false, highs, lows, points: p });
              }
            }
          }

          if (cfg.showHS && recent.length >= 5) {
            for (let i = recent.length - 5; i >= 0; i--) {
              const a = recent[i], b = recent[i + 1], c = recent[i + 2], d = recent[i + 3], e = recent[i + 4];
              if (n - e.idx > 70) break;
              if (a.type === "H" && b.type === "L" && c.type === "H" && d.type === "L" && e.type === "H") {
                if (c.price > a.price && c.price > e.price && Math.abs(a.price - e.price) / c.price <= 0.006) {
                  const neck = (b.price + d.price) / 2;
                  const confirmed = lastClose < neck;
                  patterns.push({ kind: "HS", name: confirmed ? "Head & Shoulders" : "Forming H&S", dir: "bear", confirmed, points: [a, b, c, d, e], tags: ["LS", "", "H", "", "RS"], neckline: neck, target: neck - (c.price - neck) });
                  break;
                }
              }
              if (a.type === "L" && b.type === "H" && c.type === "L" && d.type === "H" && e.type === "L") {
                if (c.price < a.price && c.price < e.price && Math.abs(a.price - e.price) / c.price <= 0.006) {
                  const neck = (b.price + d.price) / 2;
                  const confirmed = lastClose > neck;
                  patterns.push({ kind: "HS", name: confirmed ? "Inv H&S" : "Forming Inv H&S", dir: "bull", confirmed, points: [a, b, c, d, e], tags: ["LS", "", "H", "", "RS"], neckline: neck, target: neck + (neck - c.price) });
                  break;
                }
              }
            }
          }

          return patterns.slice(0, Math.max(1, cfg.maxPatterns || 3));
        }
      };

      TV.IndicatorEngine = IndicatorEngine;
    })(window.TVChart);

(function (TV) {
      const REST_BASES = [
        "https://data-api.binance.vision",
        "https://api.binance.com",
        "https://api1.binance.com",
        "https://api3.binance.com"
      ];

      const MTF_LIST = ["1m", "5m", "15m", "4h"];
      const MTF_WEIGHTS = { "1m": 0.15, "5m": 0.25, "15m": 0.30, "4h": 0.30 };

      function calcEMA(values, period) {
        const out = new Array(values.length).fill(null);
        if (values.length < period || period < 1) return out;
        const k = 2 / (period + 1);
        let sum = 0;
        for (let i = 0; i < period; i++) sum += values[i];
        let prev = sum / period;
        out[period - 1] = prev;
        for (let i = period; i < values.length; i++) {
          prev = values[i] * k + prev * (1 - k);
          out[i] = prev;
        }
        return out;
      }

      function computePredictiveMacd(candles, cfg) {
        const empty = {
          candles: [], macd: [], signal: [], hist: [], states: [],
          angM: 0, angS: 0, distPct: 0, eta: null, accel: 0, state: "NEUTRAL",
          recentSignals: []
        };
        if (!candles || candles.length < 35) return empty;

        const closes = candles.map((c) => c.close);
        const fastLen = Math.max(2, cfg.fast || 12);
        const slowLen = Math.max(fastLen + 1, cfg.slow || 26);
        const sigLen = Math.max(2, cfg.signal || 9);
        const slopeLen = Math.max(1, Math.min(6, cfg.slopeLen || 2));
        const angleScale = Math.max(0.4, Math.min(4, cfg.angleScale || 1.8));
        const immDist = Math.max(4, cfg.imminentDist || 22);
        const immEta = Math.max(1, cfg.imminentEta || 5.5);
        const minAngle = Math.max(2, cfg.minAngle || 7);
        const dualAngle = Math.max(2, cfg.dualAngle || 8);

        const emaF = calcEMA(closes, fastLen);
        const emaS = calcEMA(closes, slowLen);
        const n = closes.length;
        const macd = new Array(n).fill(null);
        for (let i = 0; i < n; i++) {
          if (emaF[i] !== null && emaS[i] !== null) macd[i] = emaF[i] - emaS[i];
        }
        const validStart = macd.findIndex((v) => v !== null);
        const signal = new Array(n).fill(null);
        if (validStart !== -1) {
          const sub = calcEMA(macd.slice(validStart), sigLen);
          for (let i = 0; i < sub.length; i++) signal[validStart + i] = sub[i];
        }
        const hist = macd.map((m, i) => (m !== null && signal[i] !== null ? m - signal[i] : null));

        // Normalize amplitude over rolling window so angles & Dist% are scale-invariant across coins/TFs
        const states = new Array(n).fill("NEUTRAL");
        const angMArr = new Array(n).fill(0);
        const angSArr = new Array(n).fill(0);
        const distArr = new Array(n).fill(0);
        const etaArr = new Array(n).fill(null);
        const accelArr = new Array(n).fill(0);
        const recentSignals = [];

        for (let i = Math.max(slopeLen + 2, validStart + sigLen); i < n; i++) {
          const m = macd[i], s = signal[i];
          const mPrev = macd[i - 1], sPrev = signal[i - 1];
          const mSlopeBase = macd[i - slopeLen], sSlopeBase = signal[i - slopeLen];
          if (m === null || s === null || mPrev === null || sPrev === null || mSlopeBase === null || sSlopeBase === null) continue;

          // Local amplitude over last 40 bars
          let maxAmp = 1e-9;
          const winStart = Math.max(0, i - 40);
          for (let k = winStart; k <= i; k++) {
            if (macd[k] !== null) maxAmp = Math.max(maxAmp, Math.abs(macd[k]));
            if (signal[k] !== null) maxAmp = Math.max(maxAmp, Math.abs(signal[k]));
          }

          // Slope angles in degrees (-85° to +85°)
          const dm = (m - mSlopeBase) / maxAmp;
          const ds = (s - sSlopeBase) / maxAmp;
          const aM = Math.round(Math.atan2(dm * angleScale * 3.8, slopeLen) * (180 / Math.PI));
          const aS = Math.round(Math.atan2(ds * angleScale * 3.8, slopeLen) * (180 / Math.PI));
          angMArr[i] = aM;
          angSArr[i] = aS;

          // Normalized gap distance (%)
          const gap = m - s;
          const prevGap = mPrev - sPrev;
          const prev2Gap = (i >= 2 && macd[i - 2] !== null && signal[i - 2] !== null) ? (macd[i - 2] - signal[i - 2]) : prevGap;
          const absGap = Math.abs(gap);
          const distPct = Math.min(100, Math.round((absGap / (maxAmp * 0.9)) * 100));
          distArr[i] = distPct;

          // Convergence velocity & curvature acceleration
          const closingVel = Math.abs(prevGap) - absGap;
          const prevVel = Math.abs(prev2Gap) - Math.abs(prevGap);
          const accel = closingVel - prevVel;
          accelArr[i] = accel;

          let eta = null;
          if (closingVel > maxAmp * 0.004 && absGap > 0) {
            const rawEta = absGap / closingVel;
            if (rawEta >= 0.2 && rawEta <= 15) eta = rawEta;
          }
          etaArr[i] = eta;

          // State Classification (Cross -> Imminent Pre-Cross -> Dual Trend -> Neutral)
          let st = "NEUTRAL";
          const crossUp = prevGap <= 0 && gap > 0;
          const crossDn = prevGap >= 0 && gap < 0;

          if (crossUp) {
            st = "CROSS_UP";
          } else if (crossDn) {
            st = "CROSS_DN";
          } else if (eta !== null && eta <= immEta && distPct <= immDist) {
            const accelOk = !cfg.accelFilter || accel >= -maxAmp * 0.008;
            if (gap < 0 && aM >= minAngle && aM > aS && accelOk) {
              st = "SOON_UP";
            } else if (gap > 0 && aM <= -minAngle && aM < aS && accelOk) {
              st = "SOON_DN";
            }
          }

          if (st === "NEUTRAL") {
            if (aM >= dualAngle && aS >= dualAngle * 0.6 && m >= s) st = "DUAL_UP";
            else if (aM <= -dualAngle && aS <= -dualAngle * 0.6 && m <= s) st = "DUAL_DN";
          }

          states[i] = st;
          if (st === "CROSS_UP" || st === "CROSS_DN" || st === "SOON_UP" || st === "SOON_DN") {
            // Avoid spamming consecutive identical SOON signals
            const prevSt = states[i - 1];
            if (st !== prevSt) {
              recentSignals.push({ idx: i, time: candles[i].time, state: st, eta, angM: aM, angS: aS, distPct });
            }
          }
        }

        const last = n - 1;
        return {
          candles,
          macd,
          signal,
          hist,
          states,
          angM: angMArr[last],
          angS: angSArr[last],
          distPct: distArr[last],
          eta: etaArr[last],
          accel: accelArr[last],
          state: states[last],
          recentSignals: recentSignals.slice(-8)
        };
      }

      class MtfMacdEngine {
        constructor(onUpdate) {
          this.onUpdate = onUpdate;
          this.symbol = "BTCUSDT";
          this.rawByTf = {};
          this.computed = {};
          this.summary = null;
          this.pollTimer = null;
          this.fetching = false;
        }

        async fetchJson(path) {
          for (let i = 0; i < REST_BASES.length; i++) {
            try {
              const ctrl = new AbortController();
              const t = setTimeout(() => ctrl.abort(), 7000);
              const res = await fetch(REST_BASES[i] + path, { signal: ctrl.signal });
              clearTimeout(t);
              if (res.ok) return await res.json();
            } catch (e) {}
          }
          return null;
        }

        start(symbol) {
          this.symbol = symbol;
          this.rawByTf = {};
          this.computed = {};
          clearInterval(this.pollTimer);
          this.refreshAll(true);
          this.pollTimer = setInterval(() => this.refreshAll(false), 15000);
        }

        async refreshAll(isInitial) {
          if (this.fetching) return;
          this.fetching = true;
          try {
            const sym = this.symbol;
            await Promise.all(MTF_LIST.map(async (tf) => {
              const raw = await this.fetchJson(`/api/v3/klines?symbol=${sym}&interval=${tf}&limit=110`);
              if (raw && Array.isArray(raw) && sym === this.symbol) {
                this.rawByTf[tf] = raw.map((k) => ({
                  time: Number(k[0]),
                  open: parseFloat(k[1]),
                  high: parseFloat(k[2]),
                  low: parseFloat(k[3]),
                  close: parseFloat(k[4]),
                  volume: parseFloat(k[5])
                }));
              }
            }));
            this.recompute(TV.ConfigStore.data.mtfMacd);
          } catch (e) {
          } finally {
            this.fetching = false;
          }
        }

        syncActiveTimeframe(activeTf, candles, mtfCfg) {
          if (MTF_LIST.includes(activeTf) && candles && candles.length >= 35) {
            this.rawByTf[activeTf] = candles.slice(-120);
          }
          this.recompute(mtfCfg);
        }

        recompute(mtfCfg) {
          const cfg = mtfCfg || TV.ConfigStore.data.mtfMacd;
          MTF_LIST.forEach((tf) => {
            if (this.rawByTf[tf]) {
              this.computed[tf] = computePredictiveMacd(this.rawByTf[tf], cfg);
            }
          });
          this.summary = this.buildSummary();
          if (this.onUpdate) this.onUpdate(this.getSnapshot());
        }

        buildSummary() {
          let bullW = 0, bearW = 0;
          const imminentList = [];
          const crossList = [];
          const dualList = [];

          MTF_LIST.forEach((tf) => {
            const d = this.computed[tf];
            if (!d) return;
            const w = MTF_WEIGHTS[tf] || 0.25;
            if (d.state === "CROSS_UP") { bullW += w * 1.25; crossList.push({ tf, dir: "bull", d }); }
            else if (d.state === "CROSS_DN") { bearW += w * 1.25; crossList.push({ tf, dir: "bear", d }); }
            else if (d.state === "SOON_UP") { bullW += w * 1.1; imminentList.push({ tf, dir: "bull", d }); }
            else if (d.state === "SOON_DN") { bearW += w * 1.1; imminentList.push({ tf, dir: "bear", d }); }
            else if (d.state === "DUAL_UP") { bullW += w * 0.9; dualList.push({ tf, dir: "bull", d }); }
            else if (d.state === "DUAL_DN") { bearW += w * 0.9; dualList.push({ tf, dir: "bear", d }); }
            else {
              // Subtle angle lean
              if (d.angM >= 6) bullW += w * 0.25;
              else if (d.angM <= -6) bearW += w * 0.25;
            }
          });

          // Higher-timeframe macro bias (15m + 4h)
          const st15 = this.computed["15m"] ? this.computed["15m"].state : "NEUTRAL";
          const st4h = this.computed["4h"] ? this.computed["4h"].state : "NEUTRAL";
          const htfBull = ["DUAL_UP", "SOON_UP", "CROSS_UP"].includes(st15) || ["DUAL_UP", "SOON_UP", "CROSS_UP"].includes(st4h);
          const htfBear = ["DUAL_DN", "SOON_DN", "CROSS_DN"].includes(st15) || ["DUAL_DN", "SOON_DN", "CROSS_DN"].includes(st4h);
          const htfDir = htfBull && !htfBear ? "bull" : htfBear && !htfBull ? "bear" : "neutral";

          // Early-Bird Pre-Cross Opportunity Detection
          const bestImminent = imminentList.sort((a, b) => (a.d.eta || 99) - (b.d.eta || 99))[0] || null;
          let earlyEdge = null;
          if (bestImminent) {
            const alignedHtf = htfDir === bestImminent.dir || htfDir === "neutral";
            earlyEdge = {
              tf: bestImminent.tf,
              dir: bestImminent.dir,
              eta: bestImminent.d.eta,
              angM: bestImminent.d.angM,
              distPct: bestImminent.d.distPct,
              alignedHtf
            };
          }

          const total = bullW + bearW;
          let dir = "neutral";
          let strength = 50;
          if (total > 0.15) {
            const bPct = Math.round((bullW / total) * 100);
            if (bPct >= 58) { dir = "bull"; strength = Math.min(92, bPct); }
            else if (bPct <= 42) { dir = "bear"; strength = Math.min(92, 100 - bPct); }
          }

          let reason = "MTF MACD lines are neutral across timeframes.";
          if (earlyEdge) {
            reason = `EARLY PRE-CROSS (${earlyEdge.tf.toUpperCase()}): MACD converging ${earlyEdge.dir === "bull" ? "UP" : "DOWN"} (∠M ${earlyEdge.angM >= 0 ? "+" : ""}${earlyEdge.angM}°, Dist ${earlyEdge.distPct}%, ETA ~${earlyEdge.eta ? earlyEdge.eta.toFixed(1) : "?"}c)${earlyEdge.alignedHtf ? " — aligned with HTF!" : "."}`;
          } else if (crossList.length) {
            const c = crossList[0];
            reason = `${c.tf.toUpperCase()} MACD just crossed ${c.dir === "bull" ? "UP" : "DOWN"} (∠M ${c.d.angM >= 0 ? "+" : ""}${c.d.angM}°).`;
          } else if (dualList.length) {
            const tfs = dualList.filter((x) => x.dir === dir).map((x) => x.tf.toUpperCase()).join("+");
            if (tfs) reason = `MTF Dual Trend ${dir === "bull" ? "UP" : "DOWN"} active on ${tfs}.`;
          }

          return {
            dir,
            strength,
            htfDir,
            earlyEdge,
            imminentList,
            crossList,
            dualList,
            reason
          };
        }

        getSnapshot() {
          return {
            timeframes: MTF_LIST,
            byTf: this.computed,
            summary: this.summary
          };
        }
      }

      TV.MtfMacdEngine = MtfMacdEngine;
      TV.MTF_LIST = MTF_LIST;
    })(window.TVChart);

(function (TV) {
      const TradeAnalyzer = {
        analyze(candles, ind, cfg, mtfData) {
          const empty = {
            verdict: "WAIT",
            side: "neutral",
            bullProb: 50,
            bearProb: 50,
            summaryReason: "Waiting for market data…",
            reasons: [],
            votes: [],
            counts: { buy: 0, sell: 0, neutral: 0 },
            plan: { action: "WAIT", entry: 0, sl: 0, tp1: 0, tp2: 0, rr: 0 }
          };
          if (!candles || candles.length < 20 || !ind) return empty;

          const n = candles.length;
          const last = candles[n - 1];
          const price = last.close;
          const atr = Math.max(price * 0.0006, ind.atr || price * 0.001);

          let bullScore = 0;
          let bearScore = 0;
          const votes = [];
          const reasons = [];

          const addVote = (name, dir, weight, note, reasonText) => {
            votes.push({ name, dir, note });
            if (dir === "buy") bullScore += weight;
            else if (dir === "sell") bearScore += weight;
            if (reasonText) reasons.push(reasonText);
          };

          // 1. Market Structure (Weight 2.0)
          const bias = (ind.structure && ind.structure.bias) || "NEUTRAL";
          if (bias === "BULLISH") {
            addVote("Structure", "buy", 2.0, "Bullish HH/HL", "Market structure is BULLISH (higher highs & higher lows).");
          } else if (bias === "BEARISH") {
            addVote("Structure", "sell", 2.0, "Bearish LH/LL", "Market structure is BEARISH (lower highs & lower lows).");
          } else {
            addVote("Structure", "neutral", 0, "Ranging", null);
          }

          // 2. SMC Pro (CHoCH, Sweeps, Smart Money Entries) (Weight 2.2)
          const smc = ind.smcPro || { chochs: [], sweeps: [], entries: [], liqZones: [] };
          const recentEntry = smc.entries.length ? smc.entries[smc.entries.length - 1] : null;
          const recentChoch = smc.chochs.length ? smc.chochs[smc.chochs.length - 1] : null;
          const recentSweep = smc.sweeps.length ? smc.sweeps[smc.sweeps.length - 1] : null;

          if (recentEntry && n - 1 - recentEntry.idx <= 12) {
            const isB = recentEntry.dir === "bull";
            addVote("SMC Pro", isB ? "buy" : "sell", 2.2, isB ? `SM Long (${recentEntry.reason})` : `SM Short (${recentEntry.reason})`,
              `Smart Money ${isB ? "LONG" : "SHORT"} triggered via ${recentEntry.reason} ${n - 1 - recentEntry.idx} bars ago.`);
          } else if (recentChoch && n - 1 - recentChoch.toIdx <= 18) {
            const isB = recentChoch.dir === "bull";
            addVote("SMC Pro", isB ? "buy" : "sell", 1.8, isB ? "CHoCH ↑" : "CHoCH ↓",
              `Recent ${isB ? "Bullish" : "Bearish"} Change of Character (CHoCH) shifted control.`);
          } else if (recentSweep && n - 1 - recentSweep.idx <= 10) {
            const isB = recentSweep.dir === "bull";
            addVote("SMC Pro", isB ? "buy" : "sell", 1.5, isB ? "SSL Sweep ↑" : "BSL Sweep ↓",
              `Liquidity sweep rejection (${isB ? "SSL swept" : "BSL swept"}) favors reversal.`);
          } else {
            addVote("SMC Pro", "neutral", 0, `${smc.liqZones.length} Liq zones`, null);
          }

          // 3. Chart Patterns (Weight 1.8)
          const pats = ind.patterns || [];
          const activePat = pats.length ? pats[0] : null;
          if (activePat && activePat.dir !== "neutral") {
            const isB = activePat.dir === "bull";
            const w = activePat.confirmed ? 2.0 : 1.3;
            addVote("Patterns", isB ? "buy" : "sell", w, activePat.name,
              `Pattern detected: ${activePat.name} (${activePat.confirmed ? "Confirmed breakout" : "Forming setup"}).`);
          } else {
            addVote("Patterns", "neutral", 0, activePat ? activePat.name : "No pattern", null);
          }

          // 4. BTC Flow (Last 3 Candles Net Dominance) (Weight 1.4)
          const flow = ind.flow || [];
          if (flow.length >= 3) {
            let bSum = 0, sSum = 0;
            for (let i = flow.length - 3; i < flow.length; i++) {
              bSum += flow[i].buy; sSum += flow[i].sell;
            }
            const tot = bSum + sSum;
            const bPct = tot > 0 ? (bSum / tot) * 100 : 50;
            if (bPct >= 56) {
              addVote("BTC Flow", "buy", 1.4, `Buy ${Math.round(bPct)}%`, `Aggressive buyers dominate last 3 candles (${Math.round(bPct)}% buy flow).`);
            } else if (bPct <= 44) {
              addVote("BTC Flow", "sell", 1.4, `Sell ${Math.round(100 - bPct)}%`, `Aggressive sellers dominate last 3 candles (${Math.round(100 - bPct)}% sell flow).`);
            } else {
              addVote("BTC Flow", "neutral", 0, `Balanced ${Math.round(bPct)}%`, null);
            }
          }

          // 5. CVD & Absorption (Weight 1.6)
          const absCvd = ind.absCvd || { cvd: [], signals: [] };
          const recentAbs = absCvd.signals.length ? absCvd.signals[absCvd.signals.length - 1] : null;
          const cvdLen = absCvd.cvd.length;
          const cvdSlope = cvdLen >= 6 ? absCvd.cvd[cvdLen - 1] - absCvd.cvd[cvdLen - 6] : 0;

          if (recentAbs && n - 1 - recentAbs.idx <= 5) {
            const isB = recentAbs.dir === "bull";
            addVote("ABS+CVD", isB ? "buy" : "sell", 1.8, isB ? "ABS ↑ Signal" : "ABS ↓ Signal",
              `${isB ? "Bullish" : "Bearish"} limit-order absorption detected on high volume.`);
          } else if (cvdSlope > 0) {
            addVote("ABS+CVD", "buy", 1.2, "CVD Rising", "Cumulative Volume Delta (CVD) is trending upward.");
          } else if (cvdSlope < 0) {
            addVote("ABS+CVD", "sell", 1.2, "CVD Falling", "Cumulative Volume Delta (CVD) is trending downward.");
          } else {
            addVote("ABS+CVD", "neutral", 0, "CVD Flat", null);
          }

          // 6. VWAP & EMA 20/50 (Weight 1.5)
          const ve = ind.vwapEma || {};
          const vwapNow = ve.vwap && ve.vwap[n - 1];
          const emaF = ve.emaFast && ve.emaFast[n - 1];
          const emaS = ve.emaSlow && ve.emaSlow[n - 1];
          if (vwapNow && emaF && emaS) {
            if (price > vwapNow && emaF > emaS) {
              addVote("VWAP·EMA", "buy", 1.5, "Above VWAP+", "Price holds above Session VWAP with bullish EMA 20 > EMA 50.");
            } else if (price < vwapNow && emaF < emaS) {
              addVote("VWAP·EMA", "sell", 1.5, "Below VWAP-", "Price is below Session VWAP with bearish EMA 20 < EMA 50.");
            } else {
              addVote("VWAP·EMA", "neutral", 0, "Mixed Trend", null);
            }
          }

          // 7. RSI (14) (Weight 1.1)
          const rsiVal = ind.rsi && ind.rsi.line ? ind.rsi.line[n - 1] : null;
          if (rsiVal !== null && isFinite(rsiVal)) {
            if (rsiVal <= 32) {
              addVote("RSI 14", "buy", 1.3, `OS ${rsiVal.toFixed(0)}`, `RSI (${rsiVal.toFixed(1)}) is oversold — bounce probability elevated.`);
            } else if (rsiVal >= 68) {
              addVote("RSI 14", "sell", 1.3, `OB ${rsiVal.toFixed(0)}`, `RSI (${rsiVal.toFixed(1)}) is overbought — pullback risk elevated.`);
            } else if (rsiVal > 54) {
              addVote("RSI 14", "buy", 0.7, `Bull ${rsiVal.toFixed(0)}`, null);
            } else if (rsiVal < 46) {
              addVote("RSI 14", "sell", 0.7, `Bear ${rsiVal.toFixed(0)}`, null);
            } else {
              addVote("RSI 14", "neutral", 0, `Mid ${rsiVal.toFixed(0)}`, null);
            }
          }

          // 8. MACD (Weight 1.0)
          const mh = ind.macd && ind.macd.hist ? ind.macd.hist[n - 1] : null;
          const mhPrev = ind.macd && ind.macd.hist && n > 1 ? ind.macd.hist[n - 2] : null;
          if (mh !== null && isFinite(mh)) {
            if (mh > 0 && (mhPrev === null || mh >= mhPrev)) {
              addVote("MACD", "buy", 1.0, "Bull Mom.", null);
            } else if (mh < 0 && (mhPrev === null || mh <= mhPrev)) {
              addVote("MACD", "sell", 1.0, "Bear Mom.", null);
            } else {
              addVote("MACD", "neutral", 0, "Fading", null);
            }
          }

          // 9. S/R Proximity (Weight 1.0)
          const zones = (ind.sr && ind.sr.zones) || [];
          const nearSup = zones.find((z) => z.type === "S" && Math.abs(price - z.mid) <= atr * 1.2);
          const nearRes = zones.find((z) => z.type === "R" && Math.abs(z.mid - price) <= atr * 1.2);
          if (nearSup && !nearRes) {
            addVote("S/R Zone", "buy", 1.0, `At Sup (${nearSup.touches}x)`, `Price is testing strong Support (${nearSup.touches} touches).`);
          } else if (nearRes && !nearSup) {
            addVote("S/R Zone", "sell", 1.0, `At Res (${nearRes.touches}x)`, `Price is testing strong Resistance (${nearRes.touches} touches).`);
          } else {
            addVote("S/R Zone", "neutral", 0, "Mid-Range", null);
          }

          // 10. Multi-Timeframe Predictive MACD Angle & Pre-Cross (Weight up to 2.6)
          if (cfg.mtfMacd && cfg.mtfMacd.enabled && mtfData && mtfData.summary) {
            const ms = mtfData.summary;
            if (ms.earlyEdge) {
              const ee = ms.earlyEdge;
              const isB = ee.dir === "bull";
              const w = ee.alignedHtf ? 2.6 : 1.7;
              addVote(
                "MTF MACD",
                isB ? "buy" : "sell",
                w,
                `${ee.tf.toUpperCase()} SOON ${isB ? "↑" : "↓"} ~${ee.eta ? ee.eta.toFixed(1) : "?"}c`,
                ms.reason
              );
            } else if (ms.dir === "bull") {
              addVote("MTF MACD", "buy", 2.0, `MTF Bull ${ms.strength}%`, ms.reason);
            } else if (ms.dir === "bear") {
              addVote("MTF MACD", "sell", 2.0, `MTF Bear ${ms.strength}%`, ms.reason);
            } else {
              addVote("MTF MACD", "neutral", 0, "MTF Mixed", null);
            }
          }

          // Normalize probabilities (clamped 12%..88% for realism)
          const totalScore = bullScore + bearScore;
          let bullProb = 50;
          if (totalScore > 0.2) {
            const rawPct = (bullScore / totalScore) * 100;
            // Dampen slightly when total weight is small
            const strength = Math.min(1, totalScore / 8.5);
            bullProb = Math.round(50 + (rawPct - 50) * strength);
          }
          bullProb = Math.max(12, Math.min(88, bullProb));
          const bearProb = 100 - bullProb;

          let verdict = "WAIT";
          let side = "neutral";
          if (bullProb >= 70) { verdict = "STRONG BUY"; side = "bull"; }
          else if (bullProb >= 58) { verdict = "BUY"; side = "bull"; }
          else if (bearProb >= 70) { verdict = "STRONG SELL"; side = "bear"; }
          else if (bearProb >= 58) { verdict = "SELL"; side = "bear"; }

          const counts = {
            buy: votes.filter((v) => v.dir === "buy").length,
            sell: votes.filter((v) => v.dir === "sell").length,
            neutral: votes.filter((v) => v.dir === "neutral").length
          };

          // Build Actionable Trade Plan (Entry, SL, TP1, TP2)
          const lookback = candles.slice(-12);
          const swingLow = Math.min(...lookback.map((c) => c.low));
          const swingHigh = Math.max(...lookback.map((c) => c.high));

          let action = "WAIT";
          let entry = price, sl = price, tp1 = price, tp2 = price, rr = 2.0;

          if (side === "bull") {
            action = "LONG";
            const earlyBoost = mtfData && mtfData.summary && mtfData.summary.earlyEdge && mtfData.summary.earlyEdge.dir === "bull";
            const slMult = earlyBoost ? 1.15 : 1.4;
            const rawSl = Math.min(swingLow - atr * 0.25, price - atr * slMult);
            const risk = Math.max(atr * 0.85, Math.min(price * 0.015, price - rawSl));
            sl = price - risk;
            tp1 = price + risk * (earlyBoost ? 1.8 : 1.5);
            tp2 = price + risk * (earlyBoost ? 2.8 : 2.5);
            rr = earlyBoost ? 2.3 : 2.0;
          } else if (side === "bear") {
            action = "SHORT";
            const earlyBoost = mtfData && mtfData.summary && mtfData.summary.earlyEdge && mtfData.summary.earlyEdge.dir === "bear";
            const slMult = earlyBoost ? 1.15 : 1.4;
            const rawSl = Math.max(swingHigh + atr * 0.25, price + atr * slMult);
            const risk = Math.max(atr * 0.85, Math.min(price * 0.015, rawSl - price));
            sl = price + risk;
            tp1 = price - risk * (earlyBoost ? 1.8 : 1.5);
            tp2 = price - risk * (earlyBoost ? 2.8 : 2.5);
            rr = earlyBoost ? 2.3 : 2.0;
          } else {
            // Provide reference range even when waiting
            sl = price - atr * 1.4;
            tp1 = price + atr * 2.1;
            tp2 = price + atr * 3.5;
            rr = 1.5;
          }

          const summaryReason = reasons.length
            ? reasons[0]
            : `Mixed signals (${counts.buy} Buy · ${counts.sell} Sell) — wait for clearer confluence.`;

          return {
            verdict,
            side,
            bullProb,
            bearProb,
            summaryReason,
            reasons: reasons.slice(0, 5),
            votes,
            counts,
            plan: { action, entry, sl, tp1, tp2, rr }
          };
        }
      };

      TV.TradeAnalyzer = TradeAnalyzer;
    })(window.TVChart);

(function (TV) {
      const WALLET_KEY = "tv_paper_wallet_v1";

      function defaultWallet() {
        return {
          balance: 10000,
          startingBalance: 10000,
          orderSize: 1000,
          leverage: 5,
          position: null, // { id, symbol, side: "LONG"|"SHORT", entry, qty, margin, leverage, sl, tp, openTime, source }
          history: [],
          bot: {
            enabled: false,
            minProb: 66,
            earlyPreCross: true,
            htfAlignGuard: true,
            autoReverse: false,
            cooldownSec: 20,
            lastActionMs: 0,
            logs: []
          }
        };
      }

      const PaperBotEngine = {
        data: defaultWallet(),
        listeners: [],

        load() {
          try {
            const raw = localStorage.getItem(WALLET_KEY);
            if (raw) {
              const parsed = JSON.parse(raw);
              this.data = Object.assign(defaultWallet(), parsed);
              this.data.bot = Object.assign(defaultWallet().bot, parsed.bot || {});
            }
          } catch (e) {
            this.data = defaultWallet();
          }
          return this.data;
        },

        save() {
          try { localStorage.setItem(WALLET_KEY, JSON.stringify(this.data)); } catch (e) {}
          this.notify();
        },

        resetWallet() {
          const botCfg = Object.assign({}, this.data.bot, { enabled: false, logs: [] });
          this.data = defaultWallet();
          this.data.bot = botCfg;
          this.logBot("Wallet reset to $10,000.00 USDT.");
          this.save();
        },

        subscribe(fn) { this.listeners.push(fn); },
        notify() { this.listeners.forEach((fn) => { try { fn(this.data); } catch (e) {} }); },

        logBot(msg) {
          const t = new Date().toLocaleTimeString("en-US", { hour12: false });
          this.data.bot.logs.unshift(`[${t}] ${msg}`);
          if (this.data.bot.logs.length > 25) this.data.bot.logs.pop();
        },

        getUnrealizedPnl(currentPrice) {
          const pos = this.data.position;
          if (!pos || !isFinite(currentPrice)) return 0;
          const diff = pos.side === "LONG" ? currentPrice - pos.entry : pos.entry - currentPrice;
          return diff * pos.qty;
        },

        getEquity(currentPrice) {
          const pos = this.data.position;
          if (!pos) return this.data.balance;
          return this.data.balance + pos.margin + this.getUnrealizedPnl(currentPrice);
        },

        getStats() {
          const h = this.data.history;
          const wins = h.filter((t) => t.pnl > 0).length;
          const netPnl = h.reduce((s, t) => s + t.pnl, 0);
          return {
            total: h.length,
            wins,
            winRate: h.length ? (wins / h.length) * 100 : 0,
            netPnl
          };
        },

        openPosition(symbol, side, price, sl, tp, source) {
          if (!isFinite(price) || price <= 0) return false;
          if (this.data.position) {
            this.closePosition(price, "SWITCH");
          }
          const margin = Math.min(this.data.balance, Math.max(50, this.data.orderSize || 1000));
          if (margin < 20) {
            this.logBot("Insufficient paper balance to open trade.");
            this.save();
            return false;
          }
          const lev = Math.max(1, Math.min(25, this.data.leverage || 5));
          const notional = margin * lev;
          const qty = notional / price;

          // Ensure valid SL/TP fallback
          const fallbackRisk = price * 0.003;
          const safeSl = isFinite(sl) && ((side === "LONG" && sl < price) || (side === "SHORT" && sl > price))
            ? sl : (side === "LONG" ? price - fallbackRisk : price + fallbackRisk);
          const safeTp = isFinite(tp) && ((side === "LONG" && tp > price) || (side === "SHORT" && tp < price))
            ? tp : (side === "LONG" ? price + fallbackRisk * 1.8 : price - fallbackRisk * 1.8);

          this.data.balance -= margin;
          this.data.position = {
            id: Date.now(),
            symbol,
            side,
            entry: price,
            qty,
            margin,
            leverage: lev,
            sl: safeSl,
            tp: safeTp,
            openTime: Date.now(),
            source: source || "MANUAL"
          };
          this.logBot(`${source || "MANUAL"} OPEN ${side} ${symbol} @ ${price.toFixed(1)} (${lev}x)`);
          this.save();
          return true;
        },

        closePosition(exitPrice, reason) {
          const pos = this.data.position;
          if (!pos || !isFinite(exitPrice)) return null;
          const pnl = this.getUnrealizedPnl(exitPrice);
          const pnlPct = pos.margin > 0 ? (pnl / pos.margin) * 100 : 0;

          this.data.balance = Math.max(0, this.data.balance + pos.margin + pnl);
          const record = {
            symbol: pos.symbol,
            side: pos.side,
            entry: pos.entry,
            exit: exitPrice,
            pnl,
            pnlPct,
            reason: reason || "MANUAL",
            source: pos.source || "MANUAL",
            closeTime: Date.now()
          };
          this.data.history.unshift(record);
          if (this.data.history.length > 50) this.data.history.pop();
          this.data.position = null;
          this.logBot(`CLOSE ${pos.side} ${pos.symbol} (${record.reason}) PnL: ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}`);
          this.save();
          return record;
        },

        onTick(symbol, price, analysis, mtfData) {
          if (!isFinite(price) || price <= 0) return;

          // 1. Check SL / TP on active position (only if matching symbol)
          const pos = this.data.position;
          if (pos && pos.symbol === symbol) {
            if (pos.side === "LONG") {
              if (price <= pos.sl) { this.closePosition(pos.sl, "SL HIT"); this.data.bot.lastActionMs = Date.now(); return; }
              if (price >= pos.tp) { this.closePosition(pos.tp, "TP HIT"); this.data.bot.lastActionMs = Date.now(); return; }
            } else {
              if (price >= pos.sl) { this.closePosition(pos.sl, "SL HIT"); this.data.bot.lastActionMs = Date.now(); return; }
              if (price <= pos.tp) { this.closePosition(pos.tp, "TP HIT"); this.data.bot.lastActionMs = Date.now(); return; }
            }
          }

          // 2. Auto-Bot Decision Loop (Standard Confluence + Early Pre-Cross Execution)
          const bot = this.data.bot;
          if (!bot.enabled || !analysis) return;

          const now = Date.now();
          if (now - bot.lastActionMs < (bot.cooldownSec || 20) * 1000) return;

          const minP = bot.minProb || 66;
          const ms = mtfData && mtfData.summary ? mtfData.summary : null;
          const ee = ms && ms.earlyEdge ? ms.earlyEdge : null;

          // Early Pre-Cross trigger fires before MACD lines meet when aligned with HTF
          const earlyLong = !!(bot.earlyPreCross && ee && ee.dir === "bull" && ee.alignedHtf && (ee.eta || 9) <= 4.0 && analysis.bullProb >= Math.max(56, minP - 6));
          const earlyShort = !!(bot.earlyPreCross && ee && ee.dir === "bear" && ee.alignedHtf && (ee.eta || 9) <= 4.0 && analysis.bearProb >= Math.max(56, minP - 6));

          // Optional HTF MACD Alignment Guard prevents fighting strong 15m/4h trend
          const blockLong = !!(bot.htfAlignGuard && ms && ms.htfDir === "bear");
          const blockShort = !!(bot.htfAlignGuard && ms && ms.htfDir === "bull");

          const wantLong = !blockLong && ((analysis.bullProb >= minP && analysis.plan.action === "LONG") || earlyLong);
          const wantShort = !blockShort && ((analysis.bearProb >= minP && analysis.plan.action === "SHORT") || earlyShort);
          const srcTag = (earlyLong || earlyShort) ? `BOT·PRE(${ee.tf.toUpperCase()})` : "BOT";

          if (!this.data.position) {
            if (wantLong) {
              bot.lastActionMs = now;
              this.openPosition(symbol, "LONG", price, analysis.plan.sl, analysis.plan.tp1, srcTag);
            } else if (wantShort) {
              bot.lastActionMs = now;
              this.openPosition(symbol, "SHORT", price, analysis.plan.sl, analysis.plan.tp1, srcTag);
            }
          } else if (bot.autoReverse && this.data.position.symbol === symbol) {
            if (this.data.position.side === "LONG" && wantShort) {
              bot.lastActionMs = now;
              this.openPosition(symbol, "SHORT", price, analysis.plan.sl, analysis.plan.tp1, srcTag);
            } else if (this.data.position.side === "SHORT" && wantLong) {
              bot.lastActionMs = now;
              this.openPosition(symbol, "LONG", price, analysis.plan.sl, analysis.plan.tp1, srcTag);
            }
          }
        }
      };

      TV.PaperBotEngine = PaperBotEngine;
    })(window.TVChart);

(function (TV) {
      function fmtPrice(val, dec) {
        if (!isFinite(val)) return "--";
        return val.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
      }

      function fmtCompact(val, dec) {
        if (!isFinite(val)) return "0";
        const abs = Math.abs(val);
        if (abs >= 1e6) return (val / 1e6).toFixed(1) + "M";
        if (abs >= 1e3) return (val / 1e3).toFixed(1) + "K";
        return val.toFixed(dec !== undefined ? dec : 2);
      }

      function fmtTime(ts, tf) {
        const d = new Date(ts);
        const hh = d.getHours(), mm = String(d.getMinutes()).padStart(2, "0");
        if (tf === "1h" || tf === "4h") {
          const mon = d.toLocaleString("en-US", { month: "short" });
          return `${mon} ${d.getDate()} ${String(hh).padStart(2, "0")}:${mm}`;
        }
        return `${String(hh % 12 || 12).padStart(2, "0")}:${mm} ${hh >= 12 ? "PM" : "AM"}`;
      }

      function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
      }

      function drawPill(ctx, text, cx, cy, bg, fg, border, fontSize) {
        ctx.save();
        ctx.font = `700 ${fontSize || 9.5}px -apple-system, BlinkMacSystemFont, sans-serif`;
        const tw = ctx.measureText(text).width;
        const h = (fontSize || 9.5) + 6, w = tw + 10;
        roundRect(ctx, cx - w / 2, cy - h / 2, w, h, 4);
        ctx.fillStyle = bg; ctx.fill();
        if (border) { ctx.strokeStyle = border; ctx.lineWidth = 1; ctx.stroke(); }
        ctx.fillStyle = fg; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(text, cx, cy + 0.5);
        ctx.restore();
      }

      class CanvasRenderer {
        constructor(canvas, state) {
          this.canvas = canvas;
          this.ctx = canvas.getContext("2d");
          this.state = state;
          this.width = 360; this.height = 560;
          this.dpr = Math.min(window.devicePixelRatio || 1, 3);
          this.axisRightW = 64; this.axisBottomH = 26;
          this.layout = { main: null, panes: [] };

          if (typeof ResizeObserver !== "undefined" && canvas.parentElement) {
            this.resizeObserver = new ResizeObserver(() => this.resize());
            this.resizeObserver.observe(canvas.parentElement);
          }
          window.addEventListener("resize", () => this.resize());
          this.resize();
        }

        resize() {
          const parent = this.canvas.parentElement;
          if (!parent) return;
          const rect = parent.getBoundingClientRect();
          if (rect.width < 10 || rect.height < 10) return;
          this.width = Math.floor(rect.width);
          this.height = Math.floor(rect.height);
          this.dpr = Math.min(window.devicePixelRatio || 1, 3);
          this.canvas.width = Math.floor(this.width * this.dpr);
          this.canvas.height = Math.floor(this.height * this.dpr);
          this.canvas.style.width = this.width + "px";
          this.canvas.style.height = this.height + "px";
          this.state.needsRender = true;
        }

        computeLayout(cfg) {
          const totalH = Math.max(120, this.height - this.axisBottomH);
          const activePanes = [];
          if (cfg.absCvd.enabled && cfg.absCvd.showSubPane) activePanes.push("cvd");
          if (cfg.rsi.enabled) activePanes.push("rsi");
          if (cfg.macd.enabled) activePanes.push("macd");

          const maxSubTotal = Math.floor(totalH * 0.45);
          let eachSubH = 0;
          if (activePanes.length === 1) eachSubH = Math.min(104, maxSubTotal);
          else if (activePanes.length === 2) eachSubH = Math.min(82, Math.floor(maxSubTotal / 2));
          else if (activePanes.length === 3) eachSubH = Math.floor(maxSubTotal / 3);

          const mainH = totalH - eachSubH * activePanes.length;
          const plotW = Math.max(80, this.width - this.axisRightW);
          const panes = [];
          let curY = mainH;
          activePanes.forEach((id) => {
            panes.push({ id, top: curY, height: eachSubH, bottom: curY + eachSubH });
            curY += eachSubH;
          });

          this.layout = { plotW, totalH, main: { top: 0, height: mainH, bottom: mainH }, panes };
          return this.layout;
        }

        idxToX(idx) {
          const v = this.state.view;
          const rightIndex = this.state.candles.length - 1 + v.rightOffset;
          return this.layout.plotW - (rightIndex - idx) * v.spacing - v.spacing * 0.5;
        }

        xToIdx(x) {
          const v = this.state.view;
          const rightIndex = this.state.candles.length - 1 + v.rightOffset;
          return Math.round(rightIndex - (this.layout.plotW - x - v.spacing * 0.5) / v.spacing);
        }

        priceToY(price) {
          const { top, height } = this.layout.main;
          const padTop = 34, padBot = Math.max(24, height * 0.16);
          const usableH = Math.max(20, height - padTop - padBot);
          const { minPrice, maxPrice } = this.state.view;
          return top + padTop + ((maxPrice - price) / Math.max(1e-9, maxPrice - minPrice)) * usableH;
        }

        yToPrice(y) {
          const { top, height } = this.layout.main;
          const padTop = 34, padBot = Math.max(24, height * 0.16);
          const usableH = Math.max(20, height - padTop - padBot);
          const { minPrice, maxPrice } = this.state.view;
          return maxPrice - ((y - (top + padTop)) / usableH) * (maxPrice - minPrice);
        }

        render() {
          const ctx = this.ctx;
          const cfg = TV.ConfigStore.data;
          const candles = this.state.candles;
          const ind = this.state.indicators;
          const symMeta = TV.ConfigStore.getSymbolMeta(cfg.symbol);

          ctx.save();
          ctx.scale(this.dpr, this.dpr);
          ctx.fillStyle = "#131722";
          ctx.fillRect(0, 0, this.width, this.height);

          this.computeLayout(cfg);
          const { plotW, main, panes } = this.layout;
          if (!candles.length) { ctx.restore(); return; }

          const startIdx = Math.max(0, this.xToIdx(0) - 2);
          const endIdx = Math.min(candles.length - 1, this.xToIdx(plotW) + 2);

          if (this.state.view.autoFit) {
            let minP = Infinity, maxP = -Infinity;
            for (let i = startIdx; i <= endIdx; i++) {
              if (candles[i].low < minP) minP = candles[i].low;
              if (candles[i].high > maxP) maxP = candles[i].high;
            }
            if (isFinite(minP) && isFinite(maxP)) {
              if (maxP === minP) { maxP += 1; minP -= 1; }
              const pad = (maxP - minP) * 0.08;
              this.state.view.minPrice = minP - pad;
              this.state.view.maxPrice = maxP + pad;
            }
          }

          this.drawGridAndAxes(ctx, startIdx, endIdx, symMeta.decimals, cfg.timeframe);

          ctx.save();
          ctx.beginPath();
          ctx.rect(0, main.top, plotW, main.height);
          ctx.clip();

          this.safeDraw(() => { if (cfg.srLevels.enabled) this.drawSR(ctx, ind.sr, cfg.srLevels, plotW); });
          this.safeDraw(() => { if (cfg.smcPro.enabled) this.drawSmcZones(ctx, ind.smcPro, cfg.smcPro, plotW); });
          this.safeDraw(() => this.drawVolume(ctx, candles, ind.flow, startIdx, endIdx, cfg.btcFlow));
          this.safeDraw(() => { if (cfg.vwapEma.enabled) this.drawVwapEma(ctx, ind.vwapEma, startIdx, endIdx, cfg.vwapEma); });
          this.safeDraw(() => { if (cfg.patterns.enabled) this.drawPatterns(ctx, ind.patterns, cfg.patterns, plotW); });
          this.safeDraw(() => this.drawCandles(ctx, candles, ind.absCvd, startIdx, endIdx, cfg.absCvd));
          this.safeDraw(() => { if (cfg.structure.enabled) this.drawStructure(ctx, ind.structure, cfg.structure, startIdx, endIdx); });
          this.safeDraw(() => { if (cfg.smcPro.enabled) this.drawSmcSignals(ctx, ind.smcPro, cfg.smcPro, startIdx, endIdx); });
          this.safeDraw(() => { if (cfg.btcFlow.enabled && cfg.btcFlow.showLabels) this.drawFlowLabels(ctx, candles, ind.flow, startIdx, endIdx, cfg.btcFlow); });
          this.safeDraw(() => { if (cfg.absCvd.enabled && cfg.absCvd.showMarkers) this.drawAbsMarkers(ctx, ind.absCvd, startIdx, endIdx, cfg.absCvd, cfg.btcFlow.enabled && cfg.btcFlow.showLabels); });
          this.safeDraw(() => { if (cfg.mtfMacd.enabled && cfg.mtfMacd.showChartMarkers) this.drawMtfMarkers(ctx, candles, cfg.timeframe, startIdx, endIdx); });
          this.safeDraw(() => this.drawPriceLines(ctx, candles, startIdx, endIdx, cfg));
          this.safeDraw(() => this.drawPaperPositionLines(ctx, cfg.symbol, candles[candles.length - 1].close, symMeta.decimals, plotW));

          ctx.restore();

          this.safeDraw(() => this.drawLivePriceBadge(ctx, candles, symMeta.decimals));

          panes.forEach((pane) => {
            ctx.strokeStyle = "#2a2e39";
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(0, pane.top + 0.5); ctx.lineTo(this.width, pane.top + 0.5); ctx.stroke();
            if (pane.id === "cvd") this.safeDraw(() => this.drawCvdPane(ctx, pane, ind.absCvd, startIdx, endIdx, cfg.absCvd));
            else if (pane.id === "rsi") this.safeDraw(() => this.drawRsiPane(ctx, pane, ind.rsi, startIdx, endIdx, cfg.rsi));
            else if (pane.id === "macd") this.safeDraw(() => this.drawMacdPane(ctx, pane, ind.macd, startIdx, endIdx, cfg.macd));
          });

          if (this.state.crosshair.active) {
            this.safeDraw(() => this.drawCrosshair(ctx, candles, symMeta.decimals, cfg.timeframe));
          }

          ctx.restore();
        }

        safeDraw(fn) { try { fn(); } catch (e) {} }

        drawMtfMarkers(ctx, candles, activeTf, startIdx, endIdx) {
          const mtf = this.state.mtf;
          if (!mtf || !mtf.summary) return;
          // Minimum-noise approach: ONLY show a sleek indicator on the latest candle when a real Pre-Cross or Cross is happening across any MTF
          const lastIdx = candles.length - 1;
          if (lastIdx < startIdx || lastIdx > endIdx) return;

          const ee = mtf.summary.earlyEdge;
          const cr = mtf.summary.crossList && mtf.summary.crossList[0];
          const item = ee ? { tf: ee.tf, dir: ee.dir, kind: "SOON", eta: ee.eta } : cr ? { tf: cr.tf, dir: cr.dir, kind: "CROSS", eta: null } : null;
          if (!item) return;

          const c = candles[lastIdx];
          const x = this.idxToX(lastIdx);
          const isBull = item.dir === "bull";
          const y = isBull ? this.priceToY(c.low) + 26 : this.priceToY(c.high) - 26;
          const col = item.kind === "SOON" ? (isBull ? "#a8ff3e" : "#ffb300") : (isBull ? "#00e676" : "#ff5252");
          const txt = item.kind === "SOON"
            ? `◎ ${item.tf.toUpperCase()} ${isBull ? "↑" : "↓"} ~${item.eta ? item.eta.toFixed(1) : ""}c`
            : `◆ ${item.tf.toUpperCase()} X${isBull ? "↑" : "↓"}`;

          drawPill(ctx, txt, Math.min(this.layout.plotW - 44, x), y, "#111622", col, col, 8.5);
        }

        drawPaperPositionLines(ctx, symbol, curPrice, dec, plotW) {
          const pos = TV.PaperBotEngine.data.position;
          if (!pos || pos.symbol !== symbol) return;

          const drawLvl = (price, label, col, dash) => {
            const y = this.priceToY(price);
            if (y < 6 || y > this.layout.main.bottom - 6) return;
            ctx.save();
            ctx.strokeStyle = col;
            ctx.lineWidth = 1.3;
            if (dash) ctx.setLineDash(dash);
            ctx.beginPath();
            ctx.moveTo(0, y); ctx.lineTo(plotW, y);
            ctx.stroke();
            ctx.restore();
            drawPill(ctx, label, 64, y, "#141824", col, col, 8.5);
          };

          const pnl = TV.PaperBotEngine.getUnrealizedPnl(curPrice);
          const pnlTxt = `${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}`;
          drawLvl(pos.entry, `${pos.side} ${fmtPrice(pos.entry, dec)} (${pnlTxt})`, "#4f8bff", null);
          drawLvl(pos.tp, `TP ${fmtPrice(pos.tp, dec)}`, "#00e676", [4, 3]);
          drawLvl(pos.sl, `SL ${fmtPrice(pos.sl, dec)}`, "#ff5252", [4, 3]);
        }

        drawGridAndAxes(ctx, startIdx, endIdx, dec, tf) {
          const { plotW, main, totalH } = this.layout;
          const { minPrice, maxPrice } = this.state.view;

          ctx.strokeStyle = "#242836";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(plotW + 0.5, 0); ctx.lineTo(plotW + 0.5, totalH);
          ctx.moveTo(0, totalH + 0.5); ctx.lineTo(this.width, totalH + 0.5);
          ctx.stroke();

          const span = Math.max(1e-9, maxPrice - minPrice);
          const approxTicks = Math.max(4, Math.floor(main.height / 54));
          const rawStep = span / approxTicks;
          const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
          const norm = rawStep / mag;
          const niceStep = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
          const firstTick = Math.ceil(minPrice / niceStep) * niceStep;

          ctx.font = "500 10.5px -apple-system, BlinkMacSystemFont, sans-serif";
          ctx.textAlign = "left"; ctx.textBaseline = "middle";

          for (let p = firstTick; p <= maxPrice; p += niceStep) {
            const y = Math.round(this.priceToY(p)) + 0.5;
            if (y < main.top + 14 || y > main.bottom - 12) continue;
            ctx.strokeStyle = "rgba(42, 46, 57, 0.55)";
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(plotW, y); ctx.stroke();
            ctx.fillStyle = "#8a8f9e";
            ctx.fillText(fmtPrice(p, dec), plotW + 6, y);
          }

          const stepCandles = Math.max(1, Math.ceil(92 / this.state.view.spacing));
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          for (let i = Math.ceil(startIdx / stepCandles) * stepCandles; i <= endIdx; i += stepCandles) {
            const c = this.state.candles[i];
            if (!c) continue;
            const x = Math.round(this.idxToX(i)) + 0.5;
            if (x < 24 || x > plotW - 24) continue;
            ctx.strokeStyle = "rgba(42, 46, 57, 0.48)";
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, totalH); ctx.stroke();
            ctx.fillStyle = "#8a8f9e";
            ctx.fillText(fmtTime(c.time, tf), x, totalH + this.axisBottomH / 2);
          }
        }

        drawVolume(ctx, candles, flow, startIdx, endIdx, flowCfg) {
          const { main } = this.layout;
          const volH = main.height * 0.2;
          let maxV = 0;
          for (let i = startIdx; i <= endIdx; i++) if (candles[i].volume > maxV) maxV = candles[i].volume;
          if (maxV <= 0) return;

          const bw = Math.max(1.5, this.state.view.spacing * 0.68);
          for (let i = startIdx; i <= endIdx; i++) {
            const c = candles[i], x = this.idxToX(i) - bw / 2, totalH = (c.volume / maxV) * volH;
            if (flowCfg.enabled && flowCfg.showSplitVol && flow[i]) {
              const buyH = totalH * (flow[i].buyPct / 100);
              ctx.fillStyle = flowCfg.buyColor + "55"; ctx.fillRect(x, main.bottom - buyH, bw, buyH);
              ctx.fillStyle = flowCfg.sellColor + "55"; ctx.fillRect(x, main.bottom - totalH, bw, totalH - buyH);
            } else {
              ctx.fillStyle = c.close >= c.open ? "rgba(8, 153, 129, 0.34)" : "rgba(242, 54, 69, 0.34)";
              ctx.fillRect(x, main.bottom - totalH, bw, totalH);
            }
          }
        }

        drawCandles(ctx, candles, absCvd, startIdx, endIdx, absCfg) {
          const bw = Math.max(1.5, Math.min(26, this.state.view.spacing * 0.68));
          const absMap = new Map();
          if (absCfg.enabled && absCfg.showHalo && absCvd.signals) absCvd.signals.forEach((s) => absMap.set(s.idx, s.dir));

          for (let i = startIdx; i <= endIdx; i++) {
            const c = candles[i], x = this.idxToX(i);
            const yO = this.priceToY(c.open), yC = this.priceToY(c.close), yH = this.priceToY(c.high), yL = this.priceToY(c.low);
            const col = c.close >= c.open ? "#089981" : "#f23645";

            const absDir = absMap.get(i);
            if (absDir) {
              ctx.fillStyle = absDir === "bull" ? "rgba(0, 230, 118, 0.16)" : "rgba(255, 23, 68, 0.16)";
              ctx.fillRect(x - bw * 0.72, yH - 3, bw * 1.44, Math.max(8, yL - yH + 6));
            }
            ctx.strokeStyle = col;
            ctx.lineWidth = Math.max(1, Math.min(2, bw * 0.16));
            ctx.beginPath(); ctx.moveTo(x, yH); ctx.lineTo(x, yL); ctx.stroke();

            ctx.fillStyle = col;
            ctx.fillRect(x - bw / 2, Math.min(yO, yC), bw, Math.max(1.4, Math.abs(yC - yO)));
          }
        }

        drawVwapEma(ctx, vwapEma, startIdx, endIdx, cfg) {
          const drawLine = (arr, color, width, dash) => {
            ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width;
            if (dash) ctx.setLineDash(dash);
            ctx.beginPath();
            let started = false;
            for (let i = startIdx; i <= endIdx; i++) {
              const val = arr[i];
              if (val === null || !isFinite(val)) { started = false; continue; }
              const x = this.idxToX(i), y = this.priceToY(val);
              if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
            }
            ctx.stroke(); ctx.restore();
          };
          if (cfg.showVwap) {
            drawLine(vwapEma.vwap, cfg.vwapColor, 1.6);
            if (cfg.showBands) { drawLine(vwapEma.upper, cfg.vwapColor + "88", 1, [4, 4]); drawLine(vwapEma.lower, cfg.vwapColor + "88", 1, [4, 4]); }
          }
          if (cfg.showEmaFast) drawLine(vwapEma.emaFast, cfg.fastColor, 1.3);
          if (cfg.showEmaSlow) drawLine(vwapEma.emaSlow, cfg.slowColor, 1.3);
        }

        drawSR(ctx, sr, cfg, plotW) {
          if (!sr || !sr.zones) return;
          sr.zones.forEach((z) => {
            const yTop = this.priceToY(z.max), yBot = this.priceToY(z.min), yMid = this.priceToY(z.mid);
            const col = z.type === "R" ? cfg.resColor : cfg.supColor;
            ctx.fillStyle = col + "1c"; ctx.fillRect(0, yTop, plotW, Math.max(4, yBot - yTop));
            ctx.strokeStyle = col + "88"; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
            ctx.beginPath(); ctx.moveTo(0, yMid); ctx.lineTo(plotW, yMid); ctx.stroke(); ctx.setLineDash([]);
            if (cfg.showLabels) {
              ctx.font = "600 9.5px -apple-system, sans-serif"; ctx.fillStyle = col;
              ctx.textAlign = "right"; ctx.textBaseline = "bottom";
              ctx.fillText(`${z.type} · ${z.touches}x`, plotW - 6, yTop - 2);
            }
          });
        }

        drawStructure(ctx, structure, cfg, startIdx, endIdx) {
          if (cfg.showSwings) {
            ctx.font = "700 9px -apple-system, sans-serif"; ctx.textAlign = "center";
            structure.swings.forEach((s) => {
              if (s.idx < startIdx || s.idx > endIdx) return;
              const x = this.idxToX(s.idx), y = this.priceToY(s.price), isH = s.type === "H";
              ctx.fillStyle = isH ? cfg.bearColor : cfg.bullColor;
              ctx.textBaseline = isH ? "bottom" : "top";
              ctx.fillText(s.tag, x, isH ? y - 4 : y + 4);
            });
          }
          if (cfg.showBos) {
            structure.breaks.forEach((b) => {
              if (b.toIdx < startIdx || b.fromIdx > endIdx || b.kind === "CHoCH") return;
              const x1 = this.idxToX(b.fromIdx), x2 = this.idxToX(b.toIdx), y = this.priceToY(b.price);
              const col = b.dir === "bull" ? cfg.bullColor : cfg.bearColor;
              ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 1.1; ctx.setLineDash([3, 3]);
              ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke(); ctx.restore();
              drawPill(ctx, b.dir === "bull" ? "BOS ↑" : "BOS ↓", (x1 + x2) / 2, y, col + "33", col, col, 8.5);
            });
          }
        }

        drawSmcZones(ctx, smc, cfg, plotW) {
          if (cfg.showLiq && smc.liqZones) {
            smc.liqZones.forEach((lz) => {
              const x1 = Math.max(0, this.idxToX(lz.startIdx));
              const x2 = lz.swept ? this.idxToX(lz.endIdx) : plotW;
              if (x2 < 0 || x1 > plotW) return;
              const y = this.priceToY(lz.price), col = lz.side === "BSL" ? "#ffab00" : "#00e5ff";
              ctx.save();
              ctx.fillStyle = col + "16"; ctx.fillRect(x1, y - 4, Math.max(8, x2 - x1), 8);
              ctx.strokeStyle = col; ctx.lineWidth = 1.1; ctx.setLineDash([2, 3]);
              ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke(); ctx.restore();
              ctx.font = "700 9px -apple-system, sans-serif"; ctx.fillStyle = col;
              ctx.textAlign = "right"; ctx.textBaseline = "bottom";
              ctx.fillText(lz.label, Math.min(plotW - 4, x2 - 2), y - 4);
            });
          }
          if (cfg.showOb && smc.orderBlocks) {
            smc.orderBlocks.forEach((ob) => {
              const x1 = Math.max(0, this.idxToX(ob.idx));
              const x2 = ob.mitigatedIdx !== null ? this.idxToX(ob.mitigatedIdx) : plotW;
              if (x2 < 0 || x1 > plotW) return;
              const yTop = this.priceToY(ob.top), yBot = this.priceToY(ob.bottom);
              const col = ob.dir === "bull" ? "#00e676" : "#ff1744";
              ctx.fillStyle = col + "1e"; ctx.fillRect(x1, yTop, Math.max(10, x2 - x1), Math.max(5, yBot - yTop));
              ctx.strokeStyle = col + "77"; ctx.lineWidth = 1; ctx.strokeRect(x1, yTop, Math.max(10, x2 - x1), Math.max(5, yBot - yTop));
              ctx.font = "700 8.5px -apple-system, sans-serif"; ctx.fillStyle = col;
              ctx.textAlign = "left"; ctx.textBaseline = "top";
              ctx.fillText(ob.dir === "bull" ? "Bull OB" : "Bear OB", x1 + 4, yTop + 2);
            });
          }
        }

        drawSmcSignals(ctx, smc, cfg, startIdx, endIdx) {
          if (cfg.showChoch && smc.chochs) {
            smc.chochs.forEach((ch) => {
              if (ch.toIdx < startIdx || ch.fromIdx > endIdx) return;
              const x1 = this.idxToX(ch.fromIdx), x2 = this.idxToX(ch.toIdx), y = this.priceToY(ch.price);
              const col = ch.dir === "bull" ? "#00e676" : "#ff1744";
              ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.setLineDash([5, 3]);
              ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke(); ctx.restore();
              drawPill(ctx, ch.dir === "bull" ? "CHoCH ↑" : "CHoCH ↓", (x1 + x2) / 2, y, col, "#0b0e14", null, 9);
            });
          }
          if (cfg.showSweeps && smc.sweeps) {
            smc.sweeps.forEach((sw) => {
              if (sw.idx < startIdx || sw.idx > endIdx) return;
              const x = this.idxToX(sw.idx), y = this.priceToY(sw.price), isBull = sw.dir === "bull";
              const col = isBull ? "#00e5ff" : "#ffab00";
              drawPill(ctx, isBull ? "SWEEP ↑" : "SWEEP ↓", x, isBull ? y + 16 : y - 16, "#161b26", col, col, 8.5);
            });
          }
          if (cfg.showEntries && smc.entries) {
            smc.entries.forEach((en) => {
              if (en.idx < startIdx || en.idx > endIdx) return;
              const x = this.idxToX(en.idx), y = this.priceToY(en.price), isBull = en.dir === "bull";
              const col = isBull ? "#00e676" : "#ff1744";
              drawPill(ctx, isBull ? "SM LONG ↑" : "SM SHORT ↓", x, isBull ? y + 32 : y - 32, col, "#0b0e14", "#ffffff44", 9);
            });
          }
        }

        drawPatterns(ctx, patterns, cfg, plotW) {
          if (!patterns || !patterns.length) return;
          patterns.forEach((pat) => {
            const col = pat.dir === "bull" ? "#26c6da" : pat.dir === "bear" ? "#ff7043" : "#b388ff";
            if (pat.kind === "TRI" && pat.highs && pat.lows) {
              const h1 = pat.highs[0], h2 = pat.highs[1], l1 = pat.lows[0], l2 = pat.lows[1];
              const xh1 = this.idxToX(h1.idx), yh1 = this.priceToY(h1.price), xh2 = this.idxToX(h2.idx), yh2 = this.priceToY(h2.price);
              const xl1 = this.idxToX(l1.idx), yl1 = this.priceToY(l1.price), xl2 = this.idxToX(l2.idx), yl2 = this.priceToY(l2.price);
              ctx.save(); ctx.fillStyle = col + "18";
              ctx.beginPath(); ctx.moveTo(xh1, yh1); ctx.lineTo(xh2, yh2); ctx.lineTo(xl2, yl2); ctx.lineTo(xl1, yl1); ctx.closePath(); ctx.fill();
              ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
              ctx.beginPath(); ctx.moveTo(xh1, yh1); ctx.lineTo(xh2, yh2); ctx.moveTo(xl1, yl1); ctx.lineTo(xl2, yl2); ctx.stroke(); ctx.restore();
              drawPill(ctx, pat.name, (xh2 + xl2) / 2, Math.min(yh2, yl2) - 14, "#1a1f2e", col, col, 9);
              return;
            }
            if (!pat.points || pat.points.length < 3) return;
            ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 1.6;
            if (!pat.confirmed) ctx.setLineDash([5, 3]);
            ctx.beginPath();
            pat.points.forEach((pt, idx) => { const x = this.idxToX(pt.idx), y = this.priceToY(pt.price); if (idx === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
            ctx.stroke(); ctx.restore();

            if (pat.tags) {
              ctx.font = "700 8.5px -apple-system, sans-serif"; ctx.fillStyle = col; ctx.textAlign = "center";
              pat.points.forEach((pt, idx) => { if (!pat.tags[idx]) return; ctx.fillText(pat.tags[idx], this.idxToX(pt.idx), pt.type === "H" ? this.priceToY(pt.price) - 12 : this.priceToY(pt.price) + 14); });
            }

            const firstX = this.idxToX(pat.points[0].idx);
            const lastX = Math.min(plotW - 10, this.idxToX(pat.points[pat.points.length - 1].idx) + 40);
            const neckY = this.priceToY(pat.neckline);
            ctx.save(); ctx.strokeStyle = col + "aa"; ctx.lineWidth = 1.1; ctx.setLineDash([3, 3]);
            ctx.beginPath(); ctx.moveTo(firstX, neckY); ctx.lineTo(lastX, neckY); ctx.stroke(); ctx.restore();

            const midPt = pat.points[Math.floor(pat.points.length / 2)];
            drawPill(ctx, pat.name, this.idxToX(midPt.idx), this.priceToY(midPt.price) + (pat.dir === "bull" ? -16 : 16), "#1a1f2e", col, col, 9);

            if (cfg.showTargets && isFinite(pat.target)) {
              const ty = this.priceToY(pat.target);
              if (ty > 10 && ty < this.layout.main.bottom - 10) {
                ctx.save(); ctx.strokeStyle = col + "77"; ctx.setLineDash([2, 4]);
                ctx.beginPath(); ctx.moveTo(lastX - 30, ty); ctx.lineTo(lastX + 20, ty); ctx.stroke(); ctx.restore();
                ctx.font = "700 8.5px -apple-system, sans-serif"; ctx.fillStyle = col; ctx.textAlign = "left";
                ctx.fillText("TP", lastX - 28, ty - 3);
              }
            }
          });
        }

        drawFlowLabels(ctx, candles, flow, startIdx, endIdx, cfg) {
          if (this.state.view.spacing < 14) return;
          let lastXTop = -999, lastXBot = -999;
          ctx.font = `600 ${cfg.fontSize || 9}px -apple-system, sans-serif`; ctx.textAlign = "center";
          for (let i = startIdx; i <= endIdx; i++) {
            const f = flow[i]; if (!f || f.total < (cfg.minVol || 0)) continue;
            const x = this.idxToX(i), c = candles[i], dec = cfg.decimals !== undefined ? cfg.decimals : 2, isLast = i === candles.length - 1;
            if ((f.buyPct >= (cfg.minDomPct || 50) || isLast) && (x - lastXTop >= 46 || isLast)) {
              ctx.fillStyle = cfg.buyColor; ctx.textBaseline = "bottom";
              ctx.fillText(`B ${fmtCompact(f.buy, dec)} (${Math.round(f.buyPct)}%)`, x, this.priceToY(c.high) - 10);
              lastXTop = x;
            }
            if ((f.sellPct >= (cfg.minDomPct || 50) || isLast) && (x - lastXBot >= 46 || isLast)) {
              ctx.fillStyle = cfg.sellColor; ctx.textBaseline = "top";
              ctx.fillText(`S ${fmtCompact(f.sell, dec)} (${Math.round(f.sellPct)}%)`, x, this.priceToY(c.low) + 10);
              lastXBot = x;
            }
          }
        }

        drawAbsMarkers(ctx, absCvd, startIdx, endIdx, cfg, hasFlowLabels) {
          if (!absCvd || !absCvd.signals) return;
          const offset = hasFlowLabels ? 24 : 14;
          absCvd.signals.forEach((s) => {
            if (s.idx < startIdx || s.idx > endIdx) return;
            const x = this.idxToX(s.idx), y = this.priceToY(s.price);
            if (s.dir === "bull") drawPill(ctx, "ABS ↑", x, y + offset, "#102820", cfg.bullColor, cfg.bullColor, 8.5);
            else drawPill(ctx, "ABS ↓", x, y - offset, "#2c1419", cfg.bearColor, cfg.bearColor, 8.5);
          });
        }

        drawPriceLines(ctx, candles, startIdx, endIdx, cfg) {
          const { plotW } = this.layout;
          const last = candles[candles.length - 1], yLast = this.priceToY(last.close);
          ctx.save();
          ctx.strokeStyle = last.close >= last.open ? "#089981" : "#f23645";
          ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
          ctx.beginPath(); ctx.moveTo(0, yLast); ctx.lineTo(plotW, yLast); ctx.stroke();

          if (cfg.showHiLoLines) {
            let hi = -Infinity, lo = Infinity;
            for (let i = startIdx; i <= endIdx; i++) { if (candles[i].high > hi) hi = candles[i].high; if (candles[i].low < lo) lo = candles[i].low; }
            if (isFinite(hi) && isFinite(lo)) {
              ctx.strokeStyle = "rgba(242, 54, 69, 0.45)"; ctx.setLineDash([4, 5]);
              ctx.beginPath(); ctx.moveTo(0, this.priceToY(hi)); ctx.lineTo(plotW, this.priceToY(hi)); ctx.moveTo(0, this.priceToY(lo)); ctx.lineTo(plotW, this.priceToY(lo)); ctx.stroke();
            }
          }
          ctx.restore();
        }

        drawLivePriceBadge(ctx, candles, dec) {
          const { plotW, main } = this.layout;
          const last = candles[candles.length - 1];
          const y = Math.max(main.top + 16, Math.min(main.bottom - 16, this.priceToY(last.close)));
          const bg = last.close >= last.open ? "#089981" : "#f23645";
          const remSec = Math.max(0, Math.floor((last.closeTime - Date.now()) / 1000));
          const mm = String(Math.floor(remSec / 60)).padStart(2, "0"), ss = String(remSec % 60).padStart(2, "0");

          const bx = plotW + 1, bw = this.axisRightW - 2;
          roundRect(ctx, bx, y - 14, bw, 28, 3);
          ctx.fillStyle = bg; ctx.fill();
          ctx.fillStyle = "#ffffff"; ctx.font = "700 10.5px -apple-system, sans-serif";
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(fmtPrice(last.close, dec), bx + bw / 2, y - 5.5);
          ctx.font = "600 9.5px -apple-system, sans-serif"; ctx.fillStyle = "rgba(255,255,255,0.88)";
          ctx.fillText(`${mm}:${ss}`, bx + bw / 2, y + 6.5);
        }

        drawCvdPane(ctx, pane, absCvd, startIdx, endIdx, cfg) {
          const { plotW } = this.layout;
          const { cvd, delta, signals } = absCvd;
          let minC = Infinity, maxC = -Infinity, maxD = 1e-6;
          for (let i = startIdx; i <= endIdx; i++) {
            if (cvd[i] < minC) minC = cvd[i];
            if (cvd[i] > maxC) maxC = cvd[i];
            if (Math.abs(delta[i]) > maxD) maxD = Math.abs(delta[i]);
          }
          if (!isFinite(minC)) return;
          if (maxC === minC) { maxC += 1; minC -= 1; }
          const pad = (maxC - minC) * 0.14; minC -= pad; maxC += pad;
          const mapY = (v) => pane.top + 14 + ((maxC - v) / (maxC - minC)) * (pane.height - 20);

          ctx.save(); ctx.beginPath(); ctx.rect(0, pane.top, plotW, pane.height); ctx.clip();
          const midY = pane.top + pane.height * 0.55, maxBarH = pane.height * 0.36, bw = Math.max(1.5, this.state.view.spacing * 0.62);
          for (let i = startIdx; i <= endIdx; i++) {
            const d = delta[i] || 0, h = (Math.abs(d) / maxD) * maxBarH;
            ctx.fillStyle = d >= 0 ? "rgba(8, 153, 129, 0.35)" : "rgba(242, 54, 69, 0.35)";
            ctx.fillRect(this.idxToX(i) - bw / 2, d >= 0 ? midY - h : midY, bw, h);
          }
          ctx.beginPath();
          for (let i = startIdx; i <= endIdx; i++) { const x = this.idxToX(i), y = mapY(cvd[i]); if (i === startIdx) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
          ctx.strokeStyle = cfg.cvdColor; ctx.lineWidth = 1.6; ctx.stroke();

          signals.forEach((s) => {
            if (s.idx < startIdx || s.idx > endIdx) return;
            ctx.beginPath(); ctx.arc(this.idxToX(s.idx), mapY(cvd[s.idx]), 3.2, 0, Math.PI * 2);
            ctx.fillStyle = s.dir === "bull" ? cfg.bullColor : cfg.bearColor; ctx.fill();
          });

          ctx.font = "600 9.5px -apple-system, sans-serif"; ctx.fillStyle = "#8a8f9e"; ctx.textAlign = "left"; ctx.textBaseline = "top";
          ctx.fillText("CVD · Delta", 8, pane.top + 4); ctx.restore();

          const lastCvd = cvd[cvd.length - 1] || 0;
          const by = Math.max(pane.top + 10, Math.min(pane.bottom - 10, mapY(lastCvd)));
          roundRect(ctx, plotW + 2, by - 9, this.axisRightW - 4, 18, 3);
          ctx.fillStyle = cfg.cvdColor; ctx.fill();
          ctx.fillStyle = "#fff"; ctx.font = "700 9.5px -apple-system, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText((lastCvd >= 0 ? "+" : "") + fmtCompact(lastCvd, 1), plotW + this.axisRightW / 2, by);
        }

        drawRsiPane(ctx, pane, rsi, startIdx, endIdx, cfg) {
          const { plotW } = this.layout;
          const mapY = (v) => pane.top + 8 + ((100 - v) / 100) * (pane.height - 16);

          ctx.save(); ctx.beginPath(); ctx.rect(0, pane.top, plotW, pane.height); ctx.clip();
          const yOb = mapY(cfg.ob || 70), y50 = mapY(50), yOs = mapY(cfg.os || 30);
          ctx.fillStyle = "rgba(171, 71, 188, 0.08)"; ctx.fillRect(0, yOb, plotW, yOs - yOb);
          ctx.strokeStyle = "rgba(120, 123, 134, 0.35)"; ctx.setLineDash([3, 4]);
          ctx.beginPath(); ctx.moveTo(0, yOb); ctx.lineTo(plotW, yOb); ctx.moveTo(0, y50); ctx.lineTo(plotW, y50); ctx.moveTo(0, yOs); ctx.lineTo(plotW, yOs); ctx.stroke(); ctx.setLineDash([]);

          if (cfg.showMa) {
            ctx.beginPath(); let st = false;
            for (let i = startIdx; i <= endIdx; i++) { const v = rsi.ma[i]; if (v === null) { st = false; continue; } const x = this.idxToX(i), y = mapY(v); if (!st) { ctx.moveTo(x, y); st = true; } else ctx.lineTo(x, y); }
            ctx.strokeStyle = cfg.maColor; ctx.lineWidth = 1.1; ctx.stroke();
          }
          ctx.beginPath(); let st = false;
          for (let i = startIdx; i <= endIdx; i++) { const v = rsi.line[i]; if (v === null) { st = false; continue; } const x = this.idxToX(i), y = mapY(v); if (!st) { ctx.moveTo(x, y); st = true; } else ctx.lineTo(x, y); }
          ctx.strokeStyle = cfg.lineColor; ctx.lineWidth = 1.5; ctx.stroke();

          ctx.font = "600 9.5px -apple-system, sans-serif"; ctx.fillStyle = "#8a8f9e"; ctx.textAlign = "left"; ctx.textBaseline = "top";
          ctx.fillText(`RSI (${cfg.period})`, 8, pane.top + 4); ctx.restore();

          ctx.font = "500 9.5px -apple-system, sans-serif"; ctx.fillStyle = "#787b86"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
          ctx.fillText(String(cfg.ob), plotW + 6, yOb); ctx.fillText(String(cfg.os), plotW + 6, yOs);

          const lastRsi = rsi.line[rsi.line.length - 1];
          if (lastRsi !== null && isFinite(lastRsi)) {
            const by = Math.max(pane.top + 10, Math.min(pane.bottom - 10, mapY(lastRsi)));
            roundRect(ctx, plotW + 2, by - 9, this.axisRightW - 4, 18, 3);
            ctx.fillStyle = lastRsi >= cfg.ob ? "#f23645" : lastRsi <= cfg.os ? "#089981" : cfg.lineColor; ctx.fill();
            ctx.fillStyle = "#fff"; ctx.font = "700 9.5px -apple-system, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText(lastRsi.toFixed(1), plotW + this.axisRightW / 2, by);
          }
        }

        drawMacdPane(ctx, pane, macdObj, startIdx, endIdx, cfg) {
          const { plotW } = this.layout;
          let maxAbs = 1e-6;
          for (let i = startIdx; i <= endIdx; i++) {
            if (macdObj.macd[i] !== null) maxAbs = Math.max(maxAbs, Math.abs(macdObj.macd[i]));
            if (macdObj.signal[i] !== null) maxAbs = Math.max(maxAbs, Math.abs(macdObj.signal[i]));
            if (macdObj.hist[i] !== null) maxAbs = Math.max(maxAbs, Math.abs(macdObj.hist[i]));
          }
          maxAbs *= 1.15;
          const mapY = (v) => pane.top + pane.height / 2 - (v / maxAbs) * (pane.height * 0.42);
          const y0 = mapY(0);

          ctx.save(); ctx.beginPath(); ctx.rect(0, pane.top, plotW, pane.height); ctx.clip();
          ctx.strokeStyle = "rgba(120, 123, 134, 0.35)"; ctx.setLineDash([3, 3]);
          ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(plotW, y0); ctx.stroke(); ctx.setLineDash([]);

          const bw = Math.max(1.5, this.state.view.spacing * 0.62);
          for (let i = startIdx; i <= endIdx; i++) {
            const h = macdObj.hist[i]; if (h === null) continue;
            const prev = i > 0 ? (macdObj.hist[i - 1] || 0) : 0;
            ctx.fillStyle = h >= 0 ? (h >= prev ? "#26a69a" : "#b2dfdb88") : (h <= prev ? "#ef5350" : "#ffcdd288");
            const y = mapY(h);
            ctx.fillRect(this.idxToX(i) - bw / 2, Math.min(y0, y), bw, Math.max(1, Math.abs(y - y0)));
          }
          const drawCurve = (arr, color) => {
            ctx.beginPath(); let st = false;
            for (let i = startIdx; i <= endIdx; i++) { if (arr[i] === null) { st = false; continue; } const x = this.idxToX(i), y = mapY(arr[i]); if (!st) { ctx.moveTo(x, y); st = true; } else ctx.lineTo(x, y); }
            ctx.strokeStyle = color; ctx.lineWidth = 1.3; ctx.stroke();
          };
          drawCurve(macdObj.macd, cfg.macdColor); drawCurve(macdObj.signal, cfg.sigColor);
          ctx.font = "600 9.5px -apple-system, sans-serif"; ctx.fillStyle = "#8a8f9e"; ctx.textAlign = "left"; ctx.textBaseline = "top";
          ctx.fillText(`MACD (${cfg.fast},${cfg.slow},${cfg.signal})`, 8, pane.top + 4); ctx.restore();

          const lastM = macdObj.macd[macdObj.macd.length - 1];
          if (lastM !== null && isFinite(lastM)) {
            const by = Math.max(pane.top + 10, Math.min(pane.bottom - 10, mapY(lastM)));
            roundRect(ctx, plotW + 2, by - 9, this.axisRightW - 4, 18, 3);
            ctx.fillStyle = cfg.macdColor; ctx.fill();
            ctx.fillStyle = "#fff"; ctx.font = "700 9.5px -apple-system, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText(lastM.toFixed(1), plotW + this.axisRightW / 2, by);
          }
        }

        drawCrosshair(ctx, candles, dec, tf) {
          const ch = this.state.crosshair, { plotW, totalH, main } = this.layout;
          const idx = Math.max(0, Math.min(candles.length - 1, ch.idx));
          const x = this.idxToX(idx), y = Math.max(0, Math.min(totalH, ch.y));
          ctx.save(); ctx.strokeStyle = "rgba(180, 185, 200, 0.5)"; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, totalH); ctx.moveTo(0, y); ctx.lineTo(plotW, y); ctx.stroke(); ctx.restore();

          if (y <= main.bottom) {
            roundRect(ctx, plotW + 1, y - 10, this.axisRightW - 2, 20, 3);
            ctx.fillStyle = "#363c4e"; ctx.fill();
            ctx.fillStyle = "#ffffff"; ctx.font = "600 10px -apple-system, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText(fmtPrice(this.yToPrice(y), dec), plotW + this.axisRightW / 2, y);
          }
          const c = candles[idx];
          if (c) drawPill(ctx, fmtTime(c.time, tf), Math.max(40, Math.min(plotW - 40, x)), totalH + this.axisBottomH / 2, "#363c4e", "#ffffff", null, 10);
        }
      }

      TV.CanvasRenderer = CanvasRenderer;
      TV.fmtPrice = fmtPrice;
      TV.fmtCompact = fmtCompact;
    })(window.TVChart);

(function (TV) {
      class TouchController {
        constructor(canvas, renderer, state, callbacks) {
          this.canvas = canvas; this.renderer = renderer; this.state = state; this.cb = callbacks || {};
          this.mode = null; this.startX = 0; this.startY = 0; this.lastX = 0; this.lastY = 0;
          this.vx = 0; this.vy = 0; this.lastMoveTime = 0; this.longPressTimer = null;
          this.lastTapTime = 0; this.lastTapZone = null;
          this.pinchDistX = 0; this.pinchDistY = 0; this.pinchStartSpacing = 10;
          this.pinchStartMinP = 0; this.pinchStartMaxP = 0; this.pinchAnchorIdx = 0;
          this.mouseDown = false;
          this.bindEvents();
        }

        getZone(x, y) {
          const { plotW, totalH } = this.renderer.layout;
          if (x >= plotW && y <= totalH) return "yaxis";
          if (y > totalH) return "xaxis";
          return "plot";
        }

        bindEvents() {
          const c = this.canvas;
          c.addEventListener("touchstart", (e) => this.onTouchStart(e), { passive: false });
          c.addEventListener("touchmove", (e) => this.onTouchMove(e), { passive: false });
          c.addEventListener("touchend", (e) => this.onTouchEnd(e), { passive: false });
          c.addEventListener("touchcancel", (e) => this.onTouchEnd(e), { passive: false });
          c.addEventListener("mousedown", (e) => this.onMouseDown(e));
          window.addEventListener("mousemove", (e) => this.onMouseMove(e));
          window.addEventListener("mouseup", () => this.onMouseUp());
          c.addEventListener("wheel", (e) => this.onWheel(e), { passive: false });
          c.addEventListener("dblclick", (e) => this.onDblClick(e));
        }

        localPos(clientX, clientY) {
          const rect = this.canvas.getBoundingClientRect();
          return { x: clientX - rect.left, y: clientY - rect.top };
        }

        stopInertia() { this.vx = 0; this.vy = 0; }

        onTouchStart(e) {
          e.preventDefault(); this.stopInertia(); clearTimeout(this.longPressTimer);
          const touches = e.touches;
          if (touches.length === 2) {
            const p1 = this.localPos(touches[0].clientX, touches[0].clientY);
            const p2 = this.localPos(touches[1].clientX, touches[1].clientY);
            this.mode = "pinch";
            this.pinchDistX = Math.max(18, Math.abs(p2.x - p1.x));
            this.pinchDistY = Math.max(18, Math.abs(p2.y - p1.y));
            this.pinchStartSpacing = this.state.view.spacing;
            this.pinchStartMinP = this.state.view.minPrice;
            this.pinchStartMaxP = this.state.view.maxPrice;
            this.pinchAnchorIdx = this.renderer.xToIdx((p1.x + p2.x) / 2);
            return;
          }
          if (touches.length === 1) {
            const p = this.localPos(touches[0].clientX, touches[0].clientY);
            const zone = this.getZone(p.x, p.y);
            const now = Date.now();
            if (now - this.lastTapTime < 300 && this.lastTapZone === zone) {
              this.lastTapTime = 0;
              if (zone === "yaxis" && this.cb.onToggleAutoFit) this.cb.onToggleAutoFit(true);
              else if (zone === "xaxis" && this.cb.onResetZoom) this.cb.onResetZoom();
              return;
            }
            this.lastTapTime = now; this.lastTapZone = zone;
            this.startX = this.lastX = p.x; this.startY = this.lastY = p.y; this.lastMoveTime = now;

            if (this.state.crosshair.locked && zone === "plot") { this.mode = "crosshair"; this.updateCrosshair(p.x, p.y); return; }
            if (zone === "yaxis") this.mode = "yscale";
            else if (zone === "xaxis") this.mode = "xscale";
            else {
              this.mode = "pan";
              this.longPressTimer = setTimeout(() => {
                if (this.mode === "pan" && Math.hypot(this.lastX - this.startX, this.lastY - this.startY) < 8) {
                  this.mode = "crosshair"; this.state.crosshair.active = true; this.updateCrosshair(this.lastX, this.lastY);
                  if (navigator.vibrate) try { navigator.vibrate(15); } catch (err) {}
                }
              }, 300);
            }
          }
        }

        onTouchMove(e) {
          e.preventDefault();
          const touches = e.touches;
          if (this.mode === "pinch" && touches.length === 2) {
            const p1 = this.localPos(touches[0].clientX, touches[0].clientY);
            const p2 = this.localPos(touches[1].clientX, touches[1].clientY);
            const dx = Math.max(18, Math.abs(p2.x - p1.x)), dy = Math.max(18, Math.abs(p2.y - p1.y));
            const midX = (p1.x + p2.x) / 2;

            const newSpacing = Math.max(2.5, Math.min(44, this.pinchStartSpacing * (dx / this.pinchDistX)));
            const plotW = this.renderer.layout.plotW, n = this.state.candles.length;
            this.state.view.spacing = newSpacing;
            this.state.view.rightOffset = this.pinchAnchorIdx - (n - 1) + (plotW - midX - newSpacing * 0.5) / newSpacing;

            const ratioY = dy / this.pinchDistY;
            if (Math.abs(ratioY - 1) > 0.14) {
              this.state.view.autoFit = false;
              const midP = (this.pinchStartMinP + this.pinchStartMaxP) / 2;
              const halfSpan = ((this.pinchStartMaxP - this.pinchStartMinP) / 2) / Math.max(0.25, Math.min(4, ratioY));
              this.state.view.minPrice = midP - halfSpan; this.state.view.maxPrice = midP + halfSpan;
              if (this.cb.onAutoFitChange) this.cb.onAutoFitChange(false);
            }
            this.state.needsRender = true; this.checkLazyLoad();
            return;
          }
          if (touches.length !== 1) return;
          const p = this.localPos(touches[0].clientX, touches[0].clientY);
          const dx = p.x - this.lastX, dy = p.y - this.lastY, now = Date.now(), dt = Math.max(8, now - this.lastMoveTime);
          if (Math.hypot(p.x - this.startX, p.y - this.startY) > 6) clearTimeout(this.longPressTimer);

          if (this.mode === "crosshair") this.updateCrosshair(p.x, p.y);
          else if (this.mode === "pan") { this.panBy(dx, dy); this.vx = dx / dt; this.vy = dy / dt; }
          else if (this.mode === "yscale") this.scaleY(dy);
          else if (this.mode === "xscale") this.scaleX(dx);
          this.lastX = p.x; this.lastY = p.y; this.lastMoveTime = now;
        }

        onTouchEnd(e) {
          clearTimeout(this.longPressTimer);
          if (e.touches.length === 0) {
            if (this.mode === "crosshair" && !this.state.crosshair.locked) {
              this.state.crosshair.active = false; this.state.needsRender = true;
              if (this.cb.onCrosshairChange) this.cb.onCrosshairChange(null);
            }
            if (this.mode !== "pan") { this.vx = 0; this.vy = 0; }
            this.mode = null;
          }
        }

        onMouseDown(e) {
          const p = this.localPos(e.clientX, e.clientY), zone = this.getZone(p.x, p.y);
          this.mouseDown = true; this.stopInertia(); this.startX = this.lastX = p.x; this.startY = this.lastY = p.y;
          if (zone === "yaxis") this.mode = "yscale";
          else if (zone === "xaxis") this.mode = "xscale";
          else if (this.state.crosshair.locked) { this.mode = "crosshair"; this.updateCrosshair(p.x, p.y); }
          else this.mode = "pan";
        }

        onMouseMove(e) {
          const p = this.localPos(e.clientX, e.clientY);
          if (!this.mouseDown) { if (this.state.crosshair.locked) this.updateCrosshair(p.x, p.y); return; }
          const dx = p.x - this.lastX, dy = p.y - this.lastY;
          if (this.mode === "pan") this.panBy(dx, dy);
          else if (this.mode === "yscale") this.scaleY(dy);
          else if (this.mode === "xscale") this.scaleX(dx);
          else if (this.mode === "crosshair") this.updateCrosshair(p.x, p.y);
          this.lastX = p.x; this.lastY = p.y;
        }

        onMouseUp() { this.mouseDown = false; this.mode = null; }

        onWheel(e) {
          e.preventDefault();
          const p = this.localPos(e.clientX, e.clientY), factor = e.deltaY < 0 ? 1.12 : 0.89;
          const anchorIdx = this.renderer.xToIdx(p.x);
          const newSpacing = Math.max(2.5, Math.min(44, this.state.view.spacing * factor));
          this.state.view.spacing = newSpacing;
          this.state.view.rightOffset = anchorIdx - (this.state.candles.length - 1) + (this.renderer.layout.plotW - p.x - newSpacing * 0.5) / newSpacing;
          this.state.needsRender = true; this.checkLazyLoad();
        }

        onDblClick(e) {
          const p = this.localPos(e.clientX, e.clientY), zone = this.getZone(p.x, p.y);
          if (zone === "yaxis" && this.cb.onToggleAutoFit) this.cb.onToggleAutoFit(true);
          else if (zone === "xaxis" && this.cb.onResetZoom) this.cb.onResetZoom();
        }

        panBy(dx, dy) {
          const v = this.state.view;
          v.rightOffset = Math.max(-this.state.candles.length + 6, Math.min(40, v.rightOffset - dx / v.spacing));
          if (!v.autoFit && Math.abs(dy) > 0) {
            const deltaP = (dy / Math.max(40, this.renderer.layout.main.height - 60)) * (v.maxPrice - v.minPrice);
            v.minPrice += deltaP; v.maxPrice += deltaP;
          }
          this.state.needsRender = true; this.checkLazyLoad();
        }

        scaleY(dy) {
          const v = this.state.view; v.autoFit = false;
          const mid = (v.minPrice + v.maxPrice) / 2;
          const half = Math.max(1e-6, ((v.maxPrice - v.minPrice) / 2) * Math.exp(dy * 0.008));
          v.minPrice = mid - half; v.maxPrice = mid + half;
          if (this.cb.onAutoFitChange) this.cb.onAutoFitChange(false);
          this.state.needsRender = true;
        }

        scaleX(dx) {
          this.state.view.spacing = Math.max(2.5, Math.min(44, this.state.view.spacing * Math.exp(-dx * 0.008)));
          this.state.needsRender = true; this.checkLazyLoad();
        }

        updateCrosshair(x, y) {
          const idx = Math.max(0, Math.min(this.state.candles.length - 1, this.renderer.xToIdx(x)));
          this.state.crosshair.active = true; this.state.crosshair.idx = idx; this.state.crosshair.y = y;
          this.state.needsRender = true;
          if (this.cb.onCrosshairChange) this.cb.onCrosshairChange(idx);
        }

        stepInertia() {
          if (this.mode !== null) return;
          if (Math.abs(this.vx) < 0.015 && Math.abs(this.vy) < 0.015) { this.vx = 0; this.vy = 0; return; }
          this.panBy(this.vx * 16, this.vy * 16);
          this.vx *= 0.91; this.vy *= 0.91;
        }

        checkLazyLoad() {
          if (this.renderer.xToIdx(0) < 25 && this.cb.onNeedOlder) this.cb.onNeedOlder();
        }
      }

      TV.TouchController = TouchController;
    })(window.TVChart);

(function (TV) {
      const INDICATOR_META = [
        { key: "btcFlow", tab: "BTC Flow", title: "BTC Flow (Buy/Sell)", desc: "Per-candle Buy/Sell qty, %, and split volume bars" },
        { key: "absCvd", tab: "ABS+CVD", title: "Absorption & CVD", desc: "Limit-order absorption badges + bottom CVD pane" },
        { key: "rsi", tab: "RSI", title: "RSI (14)", desc: "Relative Strength Index sub-pane with 70/30 zones" },
        { key: "vwapEma", tab: "VWAP·EMA", title: "VWAP + EMA 20/50", desc: "Session VWAP with Fast & Slow trend EMAs" },
        { key: "srLevels", tab: "S/R", title: "Support & Resistance", desc: "Auto pivot zones with touch counts" },
        { key: "macd", tab: "MACD", title: "MACD (12,26,9)", desc: "4-color momentum histogram + MACD/Signal lines" },
        { key: "structure", tab: "Structure", title: "Market Structure", desc: "HH/HL/LH/LL swings, BOS lines & live Bias" },
        { key: "smcPro", tab: "SMC Pro", title: "SMC Pro (CHoCH · Liq)", desc: "CHoCH lines, BSL/SSL Liquidity, Sweeps, OB & Entries" },
        { key: "patterns", tab: "Patterns", title: "Chart Patterns", desc: "Live W/M, Triangles/Wedges & Head & Shoulders" },
        { key: "mtfMacd", tab: "MTF MACD", title: "MTF Predictive MACD", desc: "1m·5m·15m·4h angle convergence & pre-cross ETA matrix" }
      ];

      class UIController {
        constructor(state, actions) {
          this.state = state;
          this.actions = actions;
          this.activeTab = "ALL";
          this.azTab = "analysis";
          this.azOpen = false;
          this.mtfPageOpen = false;
          this.formulaLabOpen = false;
          this.el = {
            app: document.getElementById("app"),
            analyzerBar: document.getElementById("analyzerBar"),
            analyzerDrawer: document.getElementById("analyzerDrawer"),
            azVerdictPill: document.getElementById("azVerdictPill"),
            azReasonLine: document.getElementById("azReasonLine"),
            azBotChip: document.getElementById("azBotChip"),
            azBotChipText: document.getElementById("azBotChipText"),
            azPnlChip: document.getElementById("azPnlChip"),
            azDrawerBody: document.getElementById("azDrawerBody"),
            mtfStripBar: document.getElementById("mtfStripBar"),
            mtfStripPills: document.getElementById("mtfStripPills"),
            mtfPageBtn: document.getElementById("mtfPageBtn"),
            mtfPage: document.getElementById("mtfPage"),
            mtfBackBtn: document.getElementById("mtfBackBtn"),
            mtfPageTitle: document.getElementById("mtfPageTitle"),
            formulaLabToggleBtn: document.getElementById("formulaLabToggleBtn"),
            mtfFormulaPanel: document.getElementById("mtfFormulaPanel"),
            mtfRadarCard: document.getElementById("mtfRadarCard"),
            mtfCardsContainer: document.getElementById("mtfCardsContainer"),
            mtfSyncLabel: document.getElementById("mtfSyncLabel"),
            coinIcon: document.getElementById("coinIcon"),
            coinName: document.getElementById("coinName"),
            liveDot: document.getElementById("liveDot"),
            valO: document.getElementById("valO"),
            valH: document.getElementById("valH"),
            valL: document.getElementById("valL"),
            valC: document.getElementById("valC"),
            valChg: document.getElementById("valChg"),
            volUnit: document.getElementById("volUnit"),
            valVol: document.getElementById("valVol"),
            fxCount: document.getElementById("fxCount"),
            biasPill: document.getElementById("biasPill"),
            fxPopoverBtn: document.getElementById("fxPopoverBtn"),
            fxPopover: document.getElementById("fxPopover"),
            fxPopoverList: document.getElementById("fxPopoverList"),
            openMasterFromPopover: document.getElementById("openMasterFromPopover"),
            statusToast: document.getElementById("statusToast"),
            jumpLatestBtn: document.getElementById("jumpLatestBtn"),
            autoFitBadge: document.getElementById("autoFitBadge"),
            restoreHudBtn: document.getElementById("restoreHudBtn"),
            pillCoinIcon: document.getElementById("pillCoinIcon"),
            pillSymText: document.getElementById("pillSymText"),
            pillTfText: document.getElementById("pillTfText"),
            symbolSheetBtn: document.getElementById("symbolSheetBtn"),
            headerSymbolBtn: document.getElementById("headerSymbolBtn"),
            crosshairBtn: document.getElementById("crosshairBtn"),
            indicatorsBtn: document.getElementById("indicatorsBtn"),
            cleanChartBtn: document.getElementById("cleanChartBtn"),
            cleanChartTopBtn: document.getElementById("cleanChartTopBtn"),
            autoBtn: document.getElementById("autoBtn"),
            resetViewBtn: document.getElementById("resetViewBtn"),
            sheetBackdrop: document.getElementById("sheetBackdrop"),
            symbolSheet: document.getElementById("symbolSheet"),
            settingsSheet: document.getElementById("settingsSheet"),
            symbolChipGrid: document.getElementById("symbolChipGrid"),
            tfChipGrid: document.getElementById("tfChipGrid"),
            settingsTabs: document.getElementById("settingsTabs"),
            settingsBody: document.getElementById("settingsBody")
          };

          this.bindEvents();
          this.renderSymbolSheet();
          this.applyCleanMode();
          this.updateSymbolHeader();
        }

        bindEvents() {
          this.el.analyzerBar.addEventListener("click", () => {
            this.azOpen = !this.azOpen;
            this.el.analyzerBar.classList.toggle("open", this.azOpen);
            this.el.analyzerDrawer.classList.toggle("hidden", !this.azOpen);
            if (this.azOpen) {
              this.el.fxPopover.classList.add("hidden");
              this.renderAnalyzerDrawer();
            }
          });

          document.querySelectorAll(".az-tab-btn").forEach((btn) => {
            btn.addEventListener("click", () => {
              this.azTab = btn.getAttribute("data-aztab");
              document.querySelectorAll(".az-tab-btn").forEach((b) => b.classList.toggle("active", b === btn));
              this.renderAnalyzerDrawer();
            });
          });

          const openSym = () => { this.closeAnalyzerDrawer(); this.openSheet("symbolSheet"); };
          this.el.symbolSheetBtn.addEventListener("click", openSym);
          this.el.headerSymbolBtn.addEventListener("click", openSym);

          this.el.fxPopoverBtn.addEventListener("click", () => {
            this.closeAnalyzerDrawer();
            this.el.fxPopover.classList.toggle("hidden");
            if (!this.el.fxPopover.classList.contains("hidden")) this.renderPopover();
          });

          this.el.openMasterFromPopover.addEventListener("click", () => {
            this.el.fxPopover.classList.add("hidden");
            this.openSettings("ALL");
          });

          this.el.indicatorsBtn.addEventListener("click", () => {
            this.closeAnalyzerDrawer();
            this.openSettings("ALL");
          });

          const openMtf = () => this.openMtfPage();
          this.el.mtfPageBtn.addEventListener("click", openMtf);
          this.el.mtfStripBar.addEventListener("click", openMtf);
          this.el.mtfBackBtn.addEventListener("click", () => this.closeMtfPage());
          this.el.formulaLabToggleBtn.addEventListener("click", () => {
            this.formulaLabOpen = !this.formulaLabOpen;
            this.el.formulaLabToggleBtn.classList.toggle("active", this.formulaLabOpen);
            this.el.mtfFormulaPanel.classList.toggle("hidden", !this.formulaLabOpen);
            if (this.formulaLabOpen) this.renderFormulaLab();
          });

          const toggleClean = () => {
            TV.ConfigStore.data.cleanMode = !TV.ConfigStore.data.cleanMode;
            TV.ConfigStore.save();
            this.applyCleanMode();
          };
          this.el.cleanChartBtn.addEventListener("click", toggleClean);
          this.el.cleanChartTopBtn.addEventListener("click", toggleClean);
          this.el.restoreHudBtn.addEventListener("click", toggleClean);

          this.el.crosshairBtn.addEventListener("click", () => {
            const ch = this.state.crosshair;
            ch.locked = !ch.locked; ch.active = ch.locked;
            if (ch.active && this.state.candles.length) { ch.idx = this.state.candles.length - 1; ch.y = 140; }
            this.el.crosshairBtn.classList.toggle("active", ch.locked);
            this.state.needsRender = true;
            this.updateHUD();
          });

          const toggleAuto = () => this.actions.setAutoFit(!this.state.view.autoFit);
          this.el.autoBtn.addEventListener("click", toggleAuto);
          this.el.autoFitBadge.addEventListener("click", toggleAuto);
          this.el.resetViewBtn.addEventListener("click", () => this.actions.resetView());
          this.el.jumpLatestBtn.addEventListener("click", () => this.actions.jumpLatest());

          this.el.sheetBackdrop.addEventListener("click", () => this.closeSheets());
          document.querySelectorAll(".sheet-close").forEach((btn) => btn.addEventListener("click", () => this.closeSheets()));

          const zipBtn = document.getElementById("exportZipBtn");
          if (zipBtn) {
            zipBtn.addEventListener("click", () => {
              if (TV.exportGitHubZip) TV.exportGitHubZip();
            });
          }
        }

        applyCleanMode() {
          const clean = !!TV.ConfigStore.data.cleanMode;
          this.el.app.classList.toggle("clean-mode", clean);
          this.el.restoreHudBtn.classList.toggle("hidden", !clean);
          this.el.cleanChartBtn.classList.toggle("active", clean);
          if (clean) {
            this.el.fxPopover.classList.add("hidden");
            this.closeAnalyzerDrawer();
          }
          this.state.needsRender = true;
        }

        closeAnalyzerDrawer() {
          this.azOpen = false;
          this.el.analyzerBar.classList.remove("open");
          this.el.analyzerDrawer.classList.add("hidden");
        }

        openMtfPage() {
          this.closeAnalyzerDrawer();
          this.closeSheets();
          this.el.fxPopover.classList.add("hidden");
          this.mtfPageOpen = true;
          this.el.mtfPage.classList.remove("hidden");
          this.el.mtfPageBtn.classList.add("active");
          this.renderMtfPage();
        }

        closeMtfPage() {
          this.mtfPageOpen = false;
          this.el.mtfPage.classList.add("hidden");
          this.el.mtfPageBtn.classList.remove("active");
        }

        stateMeta(st) {
          if (st === "CROSS_UP") return { cls: "cross-up", text: "◆ CROSS UP", short: "◆X↑" };
          if (st === "CROSS_DN") return { cls: "cross-dn", text: "◆ CROSS DN", short: "◆X↓" };
          if (st === "SOON_UP") return { cls: "soon-up", text: "◎ SOON UP", short: "◎UP" };
          if (st === "SOON_DN") return { cls: "soon-dn", text: "◎ SOON DN", short: "◎DN" };
          if (st === "DUAL_UP") return { cls: "dual-up", text: "▲ DUAL UP", short: "▲UP" };
          if (st === "DUAL_DN") return { cls: "dual-dn", text: "▼ DUAL DN", short: "▼DN" };
          return { cls: "", text: "NEUTRAL", short: "NEUT" };
        }

        updateMtfStrip() {
          const cfg = TV.ConfigStore.data.mtfMacd;
          const show = !!(cfg && cfg.enabled && cfg.showBottomStrip);
          this.el.mtfStripBar.classList.toggle("hidden", !show);
          if (!show) return;

          const mtf = this.state.mtf;
          if (!mtf || !mtf.byTf) return;

          this.el.mtfStripPills.innerHTML = "";
          TV.MTF_LIST.forEach((tf) => {
            const d = mtf.byTf[tf];
            const pill = document.createElement("span");
            if (!d) {
              pill.className = "mtf-mini-pill";
              pill.textContent = `${tf.toUpperCase()} --`;
            } else {
              const sm = this.stateMeta(d.state);
              pill.className = "mtf-mini-pill " + sm.cls;
              const etaTxt = (d.state === "SOON_UP" || d.state === "SOON_DN") && d.eta ? ` ~${d.eta.toFixed(1)}c` : "";
              pill.textContent = `${tf.toUpperCase()} ${sm.short}${etaTxt}`;
            }
            this.el.mtfStripPills.appendChild(pill);
          });

          if (this.mtfPageOpen) this.renderMtfPage();
        }

        renderFormulaLab() {
          const panel = this.el.mtfFormulaPanel;
          const sec = TV.ConfigStore.data.mtfMacd;
          panel.innerHTML = `<div class="az-card-title" style="margin-bottom:4px;"><span>Formula Lab — Predictive Angle & ETA Tuning</span><span style="color:#a8ff3e">LIVE</span></div>`;

          this.addNumber(panel, "MACD Fast EMA", sec.fast, 3, 50, 1, (v) => { sec.fast = v; this.actions.recomputeMtf(); });
          this.addNumber(panel, "MACD Slow EMA", sec.slow, 6, 100, 1, (v) => { sec.slow = v; this.actions.recomputeMtf(); });
          this.addNumber(panel, "Signal EMA", sec.signal, 2, 50, 1, (v) => { sec.signal = v; this.actions.recomputeMtf(); });
          this.addNumber(panel, "Angle Lookback (Bars)", sec.slopeLen, 1, 6, 1, (v) => { sec.slopeLen = v; this.actions.recomputeMtf(); });
          this.addNumber(panel, "Angle Sensitivity", sec.angleScale, 0.5, 3.5, 0.1, (v) => { sec.angleScale = v; this.actions.recomputeMtf(); });
          this.addNumber(panel, "Imminent Max Dist (%)", sec.imminentDist, 5, 45, 1, (v) => { sec.imminentDist = v; this.actions.recomputeMtf(); });
          this.addNumber(panel, "Imminent Max ETA (Candles)", sec.imminentEta, 1, 10, 0.5, (v) => { sec.imminentEta = v; this.actions.recomputeMtf(); });
          this.addNumber(panel, "Pre-Cross Min Angle (°)", sec.minAngle, 2, 30, 1, (v) => { sec.minAngle = v; this.actions.recomputeMtf(); });
          this.addToggle(panel, "Anti-Whipsaw Curvature Filter", "Requires MACD accelerating toward Signal", sec.accelFilter, (v) => { sec.accelFilter = v; this.actions.recomputeMtf(); });
          this.addToggle(panel, "Main Chart Compact MTF Strip", "Low-noise bar below main chart", sec.showBottomStrip, (v) => { sec.showBottomStrip = v; this.updateMtfStrip(); });
          this.addToggle(panel, "Main Chart Pre-Cross Marker", "Minimal badge on latest candle only", sec.showChartMarkers, (v) => { sec.showChartMarkers = v; this.state.needsRender = true; });

          const rst = document.createElement("button");
          rst.className = "reset-tab-btn";
          rst.textContent = "Reset Formula Lab Defaults";
          rst.addEventListener("click", () => {
            TV.ConfigStore.resetSection("mtfMacd");
            this.actions.recomputeMtf();
            this.renderFormulaLab();
          });
          panel.appendChild(rst);
        }

        renderMtfPage() {
          const cfg = TV.ConfigStore.data;
          const mtf = this.state.mtf;
          const az = this.state.analysis;
          const meta = TV.ConfigStore.getSymbolMeta(cfg.symbol);
          const curPrice = this.state.candles.length ? this.state.candles[this.state.candles.length - 1].close : 0;

          this.el.mtfPageTitle.textContent = `▸ ${meta.short} PREDICTIVE MACD`;
          this.el.mtfSyncLabel.textContent = `Updated ${new Date().toLocaleTimeString("en-US", { hour12: false })}`;

          // 1. Innovative Early-Execution Radar Card
          const ms = mtf && mtf.summary ? mtf.summary : null;
          const verdictCol = !ms ? "#9598a1" : ms.dir === "bull" ? "#00e676" : ms.dir === "bear" ? "#ff5252" : "#9ba4b8";
          const verdictTitle = !ms
            ? "Scanning Multi-Timeframe Angles…"
            : ms.earlyEdge
              ? `⚡ EARLY ${ms.earlyEdge.dir === "bull" ? "LONG" : "SHORT"} WINDOW (${ms.earlyEdge.tf.toUpperCase()} ETA ~${ms.earlyEdge.eta ? ms.earlyEdge.eta.toFixed(1) : "?"}c)`
              : ms.dir === "bull"
                ? `▲ MTF BULLISH CONFLUENCE (${ms.strength}%)`
                : ms.dir === "bear"
                  ? `▼ MTF BEARISH CONFLUENCE (${ms.strength}%)`
                  : "● MTF NEUTRAL — WAIT FOR ANGLE CONVERGENCE";

          this.el.mtfRadarCard.innerHTML = `
            <div class="mtf-radar-head">
              <span>PRE-CROSS EARLY EXECUTION RADAR</span>
              <span style="color:${ms && ms.htfDir === "bull" ? "#00d4ff" : ms && ms.htfDir === "bear" ? "#e066ff" : "#8c91a0"}">HTF: ${ms ? ms.htfDir.toUpperCase() : "--"}</span>
            </div>
            <div class="mtf-radar-verdict" style="color:${verdictCol}">${verdictTitle}</div>
            <div class="mtf-radar-sub">${ms ? ms.reason : "Fetching live 1m, 5m, 15m, and 4h klines from Binance…"}</div>
            <div class="trade-btn-row" style="margin-top:4px;">
              <button class="btn-long" id="mtfEarlyLong" style="padding:8px;font-size:11.5px;">Early Paper LONG @ ${TV.fmtPrice(curPrice, meta.decimals)}</button>
              <button class="btn-short" id="mtfEarlyShort" style="padding:8px;font-size:11.5px;">Early Paper SHORT @ ${TV.fmtPrice(curPrice, meta.decimals)}</button>
            </div>
          `;
          this.el.mtfRadarCard.querySelector("#mtfEarlyLong").addEventListener("click", () => {
            const sl = az && az.plan.action === "LONG" ? az.plan.sl : curPrice * 0.996;
            const tp = az && az.plan.action === "LONG" ? az.plan.tp1 : curPrice * 1.007;
            TV.PaperBotEngine.openPosition(cfg.symbol, "LONG", curPrice, sl, tp, "MTF·EARLY");
            this.closeMtfPage();
            this.state.needsRender = true;
            this.updateAnalyzerBar();
          });
          this.el.mtfRadarCard.querySelector("#mtfEarlyShort").addEventListener("click", () => {
            const sl = az && az.plan.action === "SHORT" ? az.plan.sl : curPrice * 1.004;
            const tp = az && az.plan.action === "SHORT" ? az.plan.tp1 : curPrice * 0.993;
            TV.PaperBotEngine.openPosition(cfg.symbol, "SHORT", curPrice, sl, tp, "MTF·EARLY");
            this.closeMtfPage();
            this.state.needsRender = true;
            this.updateAnalyzerBar();
          });

          // 2. Render Each Timeframe Matrix Card (1M, 5M, 15M, 4H)
          this.el.mtfCardsContainer.innerHTML = "";
          TV.MTF_LIST.forEach((tf) => {
            const d = mtf && mtf.byTf ? mtf.byTf[tf] : null;
            const sm = d ? this.stateMeta(d.state) : this.stateMeta("NEUTRAL");
            const card = document.createElement("div");
            card.className = "mtf-card";

            const aM = d ? d.angM : 0;
            const aS = d ? d.angS : 0;
            const dist = d ? `${d.distPct}%` : "--";
            const etaStr = d && d.eta !== null ? `~${d.eta.toFixed(1)}c` : "--";

            card.innerHTML = `
              <div class="mtf-card-head">
                <div class="mtf-card-tf">
                  <span>${tf.toUpperCase()} MACD</span>
                  <button class="mtf-switch-tf-btn" data-gotf="${tf}">Open Chart ↗</button>
                </div>
                <span class="mtf-state-badge ${sm.cls}">${sm.text}</span>
              </div>
              <div class="mtf-canvas-box"><canvas data-mtfcanvas="${tf}"></canvas></div>
              <div class="mtf-card-stats">
                <span>∠M: <b class="${aM >= 0 ? "up" : "dn"}">${aM >= 0 ? "+" : ""}${aM}°</b></span>
                <span>∠S: <b class="${aS >= 0 ? "amber" : "dn"}">${aS >= 0 ? "+" : ""}${aS}°</b></span>
                <span>Dist: <b>${dist}</b></span>
                <span>ETA <b class="${d && d.eta !== null ? "lime" : ""}">${etaStr}</b></span>
              </div>
            `;

            card.querySelector("[data-gotf]").addEventListener("click", () => {
              cfg.timeframe = tf;
              TV.ConfigStore.save();
              this.renderSymbolSheet();
              this.updateSymbolHeader();
              this.closeMtfPage();
              this.actions.loadSymbol(cfg.symbol, cfg.timeframe);
            });

            this.el.mtfCardsContainer.appendChild(card);
            const miniCanvas = card.querySelector("canvas");
            if (d) this.drawMtfMiniCanvas(miniCanvas, d);
          });
        }

        drawMtfMiniCanvas(canvas, d) {
          const rect = canvas.parentElement.getBoundingClientRect();
          const w = Math.max(260, Math.floor(rect.width || 320));
          const h = Math.max(100, Math.floor(rect.height || 126));
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          canvas.width = w * dpr;
          canvas.height = h * dpr;
          const ctx = canvas.getContext("2d");
          ctx.scale(dpr, dpr);

          ctx.fillStyle = "#0a0d14";
          ctx.fillRect(0, 0, w, h);

          const count = Math.min(54, d.macd.length);
          const start = d.macd.length - count;
          const ribbonH = 18;
          const plotTop = ribbonH + 6;
          const plotBot = h - 10;
          const plotH = plotBot - plotTop;

          let minV = Infinity, maxV = -Infinity;
          for (let i = start; i < d.macd.length; i++) {
            const vals = [d.macd[i], d.signal[i], d.hist[i]];
            vals.forEach((v) => { if (v !== null && isFinite(v)) { if (v < minV) minV = v; if (v > maxV) maxV = v; } });
          }
          if (!isFinite(minV)) return;
          if (maxV === minV) { maxV += 1; minV -= 1; }
          const pad = (maxV - minV) * 0.14;
          minV -= pad; maxV += pad;

          const stepX = (w - 16) / Math.max(1, count - 1);
          const mapX = (i) => 8 + (i - start) * stepX;
          const mapY = (v) => plotTop + ((maxV - v) / (maxV - minV)) * plotH;
          const y0 = mapY(0);

          // 1. Shaded Dual-Trend Background Columns (matching reference screenshots)
          for (let i = start; i < d.macd.length; i++) {
            const st = d.states[i];
            if (st === "DUAL_UP" || st === "DUAL_DN") {
              ctx.fillStyle = st === "DUAL_UP" ? "rgba(0, 212, 255, 0.08)" : "rgba(186, 85, 211, 0.11)";
              ctx.fillRect(mapX(i) - stepX * 0.5, ribbonH, stepX, h - ribbonH);
            }
          }

          // Zero Dashed Line
          if (y0 >= plotTop && y0 <= plotBot) {
            ctx.strokeStyle = "rgba(120, 128, 150, 0.28)";
            ctx.setLineDash([3, 3]);
            ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(w, y0); ctx.stroke();
            ctx.setLineDash([]);
          }

          // 2. Histogram Bars
          const bw = Math.max(1.5, stepX * 0.52);
          for (let i = start; i < d.macd.length; i++) {
            const hv = d.hist[i];
            if (hv === null) continue;
            const y = mapY(hv);
            ctx.fillStyle = hv >= 0 ? "rgba(8, 153, 129, 0.45)" : "rgba(242, 54, 69, 0.45)";
            ctx.fillRect(mapX(i) - bw / 2, Math.min(y0, y), bw, Math.max(1, Math.abs(y - y0)));
          }

          // 3. Signal Line (Orange) & MACD Line (Cyan)
          const drawLine = (arr, col, lw) => {
            ctx.beginPath();
            let started = false;
            for (let i = start; i < arr.length; i++) {
              if (arr[i] === null) { started = false; continue; }
              const x = mapX(i), y = mapY(arr[i]);
              if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
            }
            ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke();
          };
          drawLine(d.signal, "#ff9800", 1.5);
          drawLine(d.macd, "#00d4ff", 1.7);

          // 4. Top State Ribbon + On-Curve Cross & Imminent Target Rings
          for (let i = start; i < d.macd.length; i++) {
            const st = d.states[i];
            const x = mapX(i);
            const ry = 10;

            if (st === "DUAL_UP") {
              ctx.fillStyle = "#00d4ff";
              ctx.beginPath(); ctx.moveTo(x, ry - 3.5); ctx.lineTo(x - 3, ry + 2.5); ctx.lineTo(x + 3, ry + 2.5); ctx.closePath(); ctx.fill();
            } else if (st === "DUAL_DN") {
              ctx.fillStyle = "#e066ff";
              ctx.beginPath(); ctx.moveTo(x, ry + 3.5); ctx.lineTo(x - 3, ry - 2.5); ctx.lineTo(x + 3, ry - 2.5); ctx.closePath(); ctx.fill();
            } else if (st === "CROSS_UP" || st === "CROSS_DN") {
              const col = st === "CROSS_UP" ? "#00e676" : "#ff5252";
              // Top diamond
              ctx.fillStyle = col;
              ctx.beginPath(); ctx.moveTo(x, ry - 4); ctx.lineTo(x + 3.5, ry); ctx.lineTo(x, ry + 4); ctx.lineTo(x - 3.5, ry); ctx.closePath(); ctx.fill();
              // On-curve solid dot
              if (d.macd[i] !== null) {
                const cy = mapY(d.macd[i]);
                ctx.beginPath(); ctx.arc(x, cy, 3.6, 0, Math.PI * 2);
                ctx.fillStyle = col; ctx.fill();
                ctx.strokeStyle = "#fff"; ctx.lineWidth = 0.8; ctx.stroke();
              }
            } else if (st === "SOON_UP" || st === "SOON_DN") {
              const col = st === "SOON_UP" ? "#a8ff3e" : "#ffb300";
              // Top concentric target ring
              ctx.strokeStyle = col; ctx.lineWidth = 1.3;
              ctx.beginPath(); ctx.arc(x, ry, 3.5, 0, Math.PI * 2); ctx.stroke();
              ctx.fillStyle = col;
              ctx.beginPath(); ctx.arc(x, ry, 1.3, 0, Math.PI * 2); ctx.fill();
              // On-curve target ring
              if (d.macd[i] !== null) {
                const cy = mapY(d.macd[i]);
                ctx.strokeStyle = col; ctx.lineWidth = 1.4;
                ctx.beginPath(); ctx.arc(x, cy, 4.2, 0, Math.PI * 2); ctx.stroke();
              }
            }
          }
        }

        setStatus(state, msg) {
          this.el.liveDot.className = "live-dot " + (state === "live" ? "live" : state === "err" ? "err" : "");
          if (msg) { this.el.statusToast.textContent = msg; this.el.statusToast.classList.remove("hidden"); }
          else this.el.statusToast.classList.add("hidden");
        }

        setAutoFitUI(isAuto) {
          this.el.autoBtn.classList.toggle("active", isAuto);
          this.el.autoFitBadge.classList.toggle("active", isAuto);
        }

        updateSymbolHeader() {
          const cfg = TV.ConfigStore.data;
          const meta = TV.ConfigStore.getSymbolMeta(cfg.symbol);
          this.el.coinIcon.textContent = meta.icon; this.el.coinIcon.style.background = meta.color;
          this.el.coinName.textContent = meta.label; this.el.volUnit.textContent = meta.base;
          this.el.pillCoinIcon.textContent = meta.icon; this.el.pillCoinIcon.style.background = meta.color;
          this.el.pillSymText.textContent = meta.short; this.el.pillTfText.textContent = cfg.timeframe;
        }

        updateAnalyzerBar() {
          const az = this.state.analysis;
          const w = TV.PaperBotEngine.data;
          const curPrice = this.state.candles.length ? this.state.candles[this.state.candles.length - 1].close : 0;

          if (az) {
            const pct = az.side === "bear" ? az.bearProb : az.bullProb;
            this.el.azVerdictPill.textContent = `${az.verdict} ${pct}%`;
            this.el.azVerdictPill.className = "az-verdict-pill " + (az.side === "bull" ? "bull" : az.side === "bear" ? "bear" : "");
            this.el.azReasonLine.textContent = az.summaryReason;
          }

          this.el.azBotChip.classList.toggle("on", !!w.bot.enabled);
          this.el.azBotChipText.textContent = w.bot.enabled ? "BOT ON" : "BOT";

          const eq = TV.PaperBotEngine.getEquity(curPrice);
          const diff = eq - w.startingBalance;
          this.el.azPnlChip.textContent = `$${eq.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
          this.el.azPnlChip.className = "az-pnl-chip " + (diff > 0.5 ? "pos" : diff < -0.5 ? "neg" : "");

          if (this.azOpen) this.renderAnalyzerDrawer();
        }

        renderAnalyzerDrawer() {
          const body = this.el.azDrawerBody;
          const az = this.state.analysis;
          const w = TV.PaperBotEngine.data;
          const cfg = TV.ConfigStore.data;
          const meta = TV.ConfigStore.getSymbolMeta(cfg.symbol);
          const curPrice = this.state.candles.length ? this.state.candles[this.state.candles.length - 1].close : 0;
          body.innerHTML = "";

          // TAB 1: OVERALL ANALYSIS, INDICATOR VOTES & TRADE PLAN
          if (this.azTab === "analysis") {
            if (!az) { body.innerHTML = `<div class="az-card">Loading live market analysis…</div>`; return; }

            // 1. Chart Analysis & Probability
            const card1 = document.createElement("div");
            card1.className = "az-card";
            const reasonItems = (az.reasons.length ? az.reasons : [az.summaryReason]).map((r) => `<li>${r}</li>`).join("");
            card1.innerHTML = `
              <div class="az-card-title">
                <span>1. Overall Chart Analysis & Probability</span>
                <span style="color:${az.side === "bull" ? "#00e676" : az.side === "bear" ? "#ff5252" : "#9598a1"}">${az.verdict}</span>
              </div>
              <div class="prob-labels">
                <span class="bull">BULLISH ${az.bullProb}%</span>
                <span class="bear">BEARISH ${az.bearProb}%</span>
              </div>
              <div class="prob-bar-wrap">
                <div class="prob-fill-bull" style="width:${az.bullProb}%"></div>
                <div class="prob-fill-bear" style="width:${az.bearProb}%"></div>
              </div>
              <ul class="reason-list">${reasonItems}</ul>
            `;
            body.appendChild(card1);

            // 2. Indicator Scorecard (Buy vs Sell)
            const card2 = document.createElement("div");
            card2.className = "az-card";
            const chips = az.votes.map((v) => `
              <div class="vote-chip">
                <div class="vote-chip-head">
                  <span>${v.name}</span>
                  <span class="vote-tag ${v.dir}">${v.dir.toUpperCase()}</span>
                </div>
                <div class="vote-note">${v.note}</div>
              </div>
            `).join("");
            card2.innerHTML = `
              <div class="az-card-title">
                <span>2. Indicator Buy / Sell Breakdown</span>
                <span>${az.counts.buy} Buy · ${az.counts.sell} Sell · ${az.counts.neutral} Neut</span>
              </div>
              <div class="ind-vote-grid">${chips}</div>
            `;
            body.appendChild(card2);

            // 3. Decision Making (Entry, SL, TP1, TP2 + Quick Paper Execute)
            const p = az.plan;
            const card3 = document.createElement("div");
            card3.className = "az-card";
            card3.innerHTML = `
              <div class="az-card-title">
                <span>3. Trade Decision Plan (${p.action})</span>
                <span>Est. R:R 1 : ${p.rr.toFixed(1)}</span>
              </div>
              <div class="plan-grid">
                <div class="plan-box">
                  <div class="plan-box-lbl">Suggested Entry</div>
                  <div class="plan-box-val entry">${TV.fmtPrice(p.entry, meta.decimals)}</div>
                </div>
                <div class="plan-box">
                  <div class="plan-box-lbl">Stop Loss (SL)</div>
                  <div class="plan-box-val sl">${TV.fmtPrice(p.sl, meta.decimals)}</div>
                </div>
                <div class="plan-box">
                  <div class="plan-box-lbl">Take Profit 1 (TP1)</div>
                  <div class="plan-box-val tp">${TV.fmtPrice(p.tp1, meta.decimals)}</div>
                </div>
                <div class="plan-box">
                  <div class="plan-box-lbl">Take Profit 2 (TP2)</div>
                  <div class="plan-box-val tp">${TV.fmtPrice(p.tp2, meta.decimals)}</div>
                </div>
              </div>
              <div class="trade-btn-row">
                <button class="btn-long" id="azQuickLong">Paper LONG (Buy)</button>
                <button class="btn-short" id="azQuickShort">Paper SHORT (Sell)</button>
              </div>
            `;
            body.appendChild(card3);

            card3.querySelector("#azQuickLong").addEventListener("click", () => {
              const sl = p.action === "LONG" ? p.sl : curPrice * 0.996;
              const tp = p.action === "LONG" ? p.tp1 : curPrice * 1.007;
              TV.PaperBotEngine.openPosition(cfg.symbol, "LONG", curPrice, sl, tp, "MANUAL");
              this.state.needsRender = true;
              this.azTab = "paper";
              document.querySelectorAll(".az-tab-btn").forEach((b) => b.classList.toggle("active", b.getAttribute("data-aztab") === "paper"));
              this.updateAnalyzerBar();
            });
            card3.querySelector("#azQuickShort").addEventListener("click", () => {
              const sl = p.action === "SHORT" ? p.sl : curPrice * 1.004;
              const tp = p.action === "SHORT" ? p.tp1 : curPrice * 0.993;
              TV.PaperBotEngine.openPosition(cfg.symbol, "SHORT", curPrice, sl, tp, "MANUAL");
              this.state.needsRender = true;
              this.azTab = "paper";
              document.querySelectorAll(".az-tab-btn").forEach((b) => b.classList.toggle("active", b.getAttribute("data-aztab") === "paper"));
              this.updateAnalyzerBar();
            });
            return;
          }

          // TAB 2: PAPER TRADING SIMULATOR
          if (this.azTab === "paper") {
            const eq = TV.PaperBotEngine.getEquity(curPrice);
            const net = eq - w.startingBalance;
            const stats = TV.PaperBotEngine.getStats();

            const walletCard = document.createElement("div");
            walletCard.className = "az-card";
            walletCard.innerHTML = `
              <div class="az-card-title">
                <span>Paper Wallet (${cfg.symbol})</span>
                <button class="text-link-btn" id="btnResetWallet" style="color:#ff6b77">Reset $10k</button>
              </div>
              <div class="wallet-stats">
                <div class="stat-box">
                  <div class="stat-lbl">Equity</div>
                  <div class="stat-val">$${eq.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
                <div class="stat-box">
                  <div class="stat-lbl">Total PnL</div>
                  <div class="stat-val ${net >= 0 ? "pos" : "neg"}">${net >= 0 ? "+" : ""}$${net.toFixed(2)}</div>
                </div>
                <div class="stat-box">
                  <div class="stat-lbl">Win Rate (${stats.total})</div>
                  <div class="stat-val">${stats.winRate.toFixed(0)}%</div>
                </div>
              </div>
              <div class="setting-row" style="margin-top:6px;">
                <div class="setting-label">Order Margin (USDT)</div>
                <input class="setting-input" id="inpOrderSize" type="number" min="50" max="50000" step="100" value="${w.orderSize}" />
              </div>
              <div class="setting-row">
                <div class="setting-label">Leverage</div>
                <select class="setting-select" id="selLeverage">
                  ${[1, 2, 3, 5, 10, 20].map((l) => `<option value="${l}" ${w.leverage === l ? "selected" : ""}>${l}x</option>`).join("")}
                </select>
              </div>
              <div class="trade-btn-row">
                <button class="btn-long" id="btnPaperLong">LONG @ ${TV.fmtPrice(curPrice, meta.decimals)}</button>
                <button class="btn-short" id="btnPaperShort">SHORT @ ${TV.fmtPrice(curPrice, meta.decimals)}</button>
              </div>
            `;
            body.appendChild(walletCard);

            walletCard.querySelector("#btnResetWallet").addEventListener("click", () => {
              TV.PaperBotEngine.resetWallet();
              this.state.needsRender = true;
              this.updateAnalyzerBar();
            });
            walletCard.querySelector("#inpOrderSize").addEventListener("change", (e) => {
              const v = parseFloat(e.target.value);
              if (isFinite(v) && v >= 50) { w.orderSize = v; TV.PaperBotEngine.save(); }
            });
            walletCard.querySelector("#selLeverage").addEventListener("change", (e) => {
              w.leverage = parseInt(e.target.value, 10) || 5; TV.PaperBotEngine.save();
            });
            walletCard.querySelector("#btnPaperLong").addEventListener("click", () => {
              const sl = az && az.plan.action === "LONG" ? az.plan.sl : curPrice * 0.996;
              const tp = az && az.plan.action === "LONG" ? az.plan.tp1 : curPrice * 1.007;
              TV.PaperBotEngine.openPosition(cfg.symbol, "LONG", curPrice, sl, tp, "MANUAL");
              this.state.needsRender = true; this.updateAnalyzerBar();
            });
            walletCard.querySelector("#btnPaperShort").addEventListener("click", () => {
              const sl = az && az.plan.action === "SHORT" ? az.plan.sl : curPrice * 1.004;
              const tp = az && az.plan.action === "SHORT" ? az.plan.tp1 : curPrice * 0.993;
              TV.PaperBotEngine.openPosition(cfg.symbol, "SHORT", curPrice, sl, tp, "MANUAL");
              this.state.needsRender = true; this.updateAnalyzerBar();
            });

            // Open Position Card
            if (w.position) {
              const pos = w.position;
              const uPnl = pos.symbol === cfg.symbol ? TV.PaperBotEngine.getUnrealizedPnl(curPrice) : 0;
              const uPct = pos.margin > 0 ? (uPnl / pos.margin) * 100 : 0;
              const posCard = document.createElement("div");
              posCard.className = "pos-card";
              posCard.innerHTML = `
                <div class="pos-head">
                  <span style="color:${pos.side === "LONG" ? "#00e676" : "#ff5252"}">${pos.side} ${pos.symbol} (${pos.leverage}x · ${pos.source})</span>
                  <span style="color:${uPnl >= 0 ? "#00e676" : "#ff5252"}">${uPnl >= 0 ? "+" : ""}$${uPnl.toFixed(2)} (${uPct.toFixed(1)}%)</span>
                </div>
                <div class="pos-meta">
                  <span>Entry: ${TV.fmtPrice(pos.entry, meta.decimals)}</span>
                  <span style="color:#ff5252">SL: ${TV.fmtPrice(pos.sl, meta.decimals)}</span>
                  <span style="color:#00e676">TP: ${TV.fmtPrice(pos.tp, meta.decimals)}</span>
                </div>
                <button class="btn-neutral" id="btnClosePos" style="padding:7px;margin-top:2px;">Close Position at Market</button>
              `;
              body.appendChild(posCard);
              posCard.querySelector("#btnClosePos").addEventListener("click", () => {
                TV.PaperBotEngine.closePosition(curPrice, "MANUAL");
                this.state.needsRender = true; this.updateAnalyzerBar();
              });
            }

            // Recent History
            const histCard = document.createElement("div");
            histCard.className = "az-card";
            const rows = w.history.length ? w.history.slice(0, 10).map((h) => `
              <div class="hist-row">
                <span><b style="color:${h.side === "LONG" ? "#00e676" : "#ff5252"}">${h.side}</b> ${h.symbol} · ${h.reason}</span>
                <span style="color:${h.pnl >= 0 ? "#00e676" : "#ff5252"};font-weight:700">${h.pnl >= 0 ? "+" : ""}$${h.pnl.toFixed(2)}</span>
              </div>
            `).join("") : `<div style="font-size:11px;color:#787b86">No closed paper trades yet.</div>`;
            histCard.innerHTML = `<div class="az-card-title"><span>Recent Trade History</span></div><div class="hist-list">${rows}</div>`;
            body.appendChild(histCard);
            return;
          }

          // TAB 3: AUTO-TRADING BOT
          if (this.azTab === "bot") {
            const bot = w.bot;
            const botCard = document.createElement("div");
            botCard.className = "az-card";
            botCard.innerHTML = `
              <div class="az-card-title">
                <span>Automated Strategy Bot (Paper)</span>
                <span style="color:${bot.enabled ? "#00e676" : "#8c91a0"}">${bot.enabled ? "RUNNING" : "STOPPED"}</span>
              </div>
              <div class="setting-row">
                <div>
                  <div class="setting-label">Enable Auto-Trading Bot</div>
                  <div class="setting-sub">Automatically enters LONG/SHORT with smart SL & TP</div>
                </div>
                <label class="switch"><input type="checkbox" id="chkBotEnable" ${bot.enabled ? "checked" : ""}><span class="slider"></span></label>
              </div>
              <div class="setting-row">
                <div>
                  <div class="setting-label">Min Probability to Enter (%)</div>
                  <div class="setting-sub">Higher = fewer, higher-confluence trades</div>
                </div>
                <input class="setting-input" id="inpBotMinProb" type="number" min="55" max="85" step="1" value="${bot.minProb}" />
              </div>
              <div class="setting-row">
                <div>
                  <div class="setting-label">Early Pre-Cross Execution (MTF MACD)</div>
                  <div class="setting-sub">Enter before MACD lines cross when ETA ≤ 4c & HTF aligns</div>
                </div>
                <label class="switch"><input type="checkbox" id="chkBotEarly" ${bot.earlyPreCross ? "checked" : ""}><span class="slider"></span></label>
              </div>
              <div class="setting-row">
                <div>
                  <div class="setting-label">HTF MACD Alignment Guard</div>
                  <div class="setting-sub">Block trades fighting strong 15m/4h Dual Trend</div>
                </div>
                <label class="switch"><input type="checkbox" id="chkBotHtf" ${bot.htfAlignGuard ? "checked" : ""}><span class="slider"></span></label>
              </div>
              <div class="setting-row">
                <div>
                  <div class="setting-label">Auto-Reverse on Opposite Signal</div>
                  <div class="setting-sub">Close & flip if strong opposite signal fires</div>
                </div>
                <label class="switch"><input type="checkbox" id="chkBotRev" ${bot.autoReverse ? "checked" : ""}><span class="slider"></span></label>
              </div>
              <div class="setting-row">
                <div class="setting-label">Cooldown Between Trades (sec)</div>
                <input class="setting-input" id="inpBotCool" type="number" min="5" max="300" step="5" value="${bot.cooldownSec}" />
              </div>
            `;
            body.appendChild(botCard);

            botCard.querySelector("#chkBotEnable").addEventListener("change", (e) => {
              bot.enabled = e.target.checked;
              TV.PaperBotEngine.logBot(bot.enabled ? `Auto-Bot STARTED (Min Prob ${bot.minProb}%)` : "Auto-Bot STOPPED");
              TV.PaperBotEngine.save();
              this.updateAnalyzerBar();
            });
            botCard.querySelector("#inpBotMinProb").addEventListener("change", (e) => {
              const v = parseInt(e.target.value, 10);
              if (isFinite(v)) { bot.minProb = Math.max(55, Math.min(85, v)); TV.PaperBotEngine.save(); }
            });
            botCard.querySelector("#chkBotEarly").addEventListener("change", (e) => {
              bot.earlyPreCross = e.target.checked; TV.PaperBotEngine.save();
            });
            botCard.querySelector("#chkBotHtf").addEventListener("change", (e) => {
              bot.htfAlignGuard = e.target.checked; TV.PaperBotEngine.save();
            });
            botCard.querySelector("#chkBotRev").addEventListener("change", (e) => {
              bot.autoReverse = e.target.checked; TV.PaperBotEngine.save();
            });
            botCard.querySelector("#inpBotCool").addEventListener("change", (e) => {
              const v = parseInt(e.target.value, 10);
              if (isFinite(v)) { bot.cooldownSec = Math.max(5, Math.min(300, v)); TV.PaperBotEngine.save(); }
            });

            const logCard = document.createElement("div");
            logCard.className = "az-card";
            const logsHtml = bot.logs.length
              ? bot.logs.slice(0, 12).map((l) => `<div style="font-size:10.5px;color:#b2b6c2;font-family:monospace;padding:3px 0;border-bottom:1px solid #232836">${l}</div>`).join("")
              : `<div style="font-size:11px;color:#787b86">Bot activity logs will appear here.</div>`;
            logCard.innerHTML = `<div class="az-card-title"><span>Live Bot Activity Log</span></div><div style="max-height:160px;overflow-y:auto">${logsHtml}</div>`;
            body.appendChild(logCard);
          }
        }

        updateHUD() {
          const candles = this.state.candles, cfg = TV.ConfigStore.data, ind = this.state.indicators;
          const activeCount = INDICATOR_META.filter((m) => cfg[m.key] && cfg[m.key].enabled).length;
          this.el.fxCount.textContent = `${activeCount}/${INDICATOR_META.length}`;
          this.el.jumpLatestBtn.classList.toggle("hidden", this.state.view.rightOffset > -8);

          const bias = (ind.structure && ind.structure.bias) || "NEUTRAL";
          this.el.biasPill.textContent = `● ${bias}`;
          this.el.biasPill.className = "bias-pill " + (bias === "BULLISH" ? "bull" : bias === "BEARISH" ? "bear" : "neutral");

          if (!candles.length) return;
          const idx = this.state.crosshair.active
            ? Math.max(0, Math.min(candles.length - 1, this.state.crosshair.idx))
            : candles.length - 1;
          const c = candles[idx], meta = TV.ConfigStore.getSymbolMeta(cfg.symbol), cls = c.close >= c.open ? "up" : "dn";

          this.el.valO.textContent = TV.fmtPrice(c.open, meta.decimals);
          this.el.valH.textContent = TV.fmtPrice(c.high, meta.decimals);
          this.el.valL.textContent = TV.fmtPrice(c.low, meta.decimals);
          this.el.valC.textContent = TV.fmtPrice(c.close, meta.decimals);
          ["valO", "valH", "valL", "valC"].forEach((id) => (this.el[id].parentElement.className = "ohlc-item " + cls));

          const pct = c.open > 0 ? ((c.close - c.open) / c.open) * 100 : 0;
          this.el.valChg.textContent = `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
          this.el.valChg.className = "ohlc-chg " + cls;
          this.el.valVol.textContent = TV.fmtCompact(c.volume, 2);

          if (!this.el.fxPopover.classList.contains("hidden")) this.renderPopover(idx);
          this.updateAnalyzerBar();
        }

        renderPopover(idxOverride) {
          const cfg = TV.ConfigStore.data, ind = this.state.indicators, candles = this.state.candles;
          const idx = idxOverride !== undefined ? idxOverride : Math.max(0, candles.length - 1);
          const getVal = (key) => {
            if (!candles.length) return "--";
            if (key === "btcFlow" && ind.flow[idx]) { const f = ind.flow[idx]; return `B ${TV.fmtCompact(f.buy, 2)} (${Math.round(f.buyPct)}%) · S ${TV.fmtCompact(f.sell, 2)} (${Math.round(f.sellPct)}%)`; }
            if (key === "absCvd" && ind.absCvd.cvd.length) { const v = ind.absCvd.cvd[idx] || 0; return `CVD ${v >= 0 ? "+" : ""}${TV.fmtCompact(v, 1)} · ${ind.absCvd.signals.length} sig`; }
            if (key === "rsi" && ind.rsi.line[idx] != null) return `RSI ${ind.rsi.line[idx].toFixed(1)}`;
            if (key === "vwapEma" && ind.vwapEma.vwap[idx]) return `VWAP ${TV.fmtPrice(ind.vwapEma.vwap[idx], 1)}`;
            if (key === "srLevels") return `${(ind.sr.zones || []).length} active zones`;
            if (key === "macd" && ind.macd.macd[idx] != null) return `MACD ${ind.macd.macd[idx].toFixed(1)}`;
            if (key === "structure") return `Bias: ${ind.structure.bias}`;
            if (key === "smcPro") return `${ind.smcPro.chochs.length} CHoCH · ${ind.smcPro.liqZones.length} Liq`;
            if (key === "patterns") return ind.patterns.length ? ind.patterns.map((p) => p.name).join(", ") : "Scanning…";
            if (key === "mtfMacd") {
              const ms = this.state.mtf && this.state.mtf.summary;
              return ms ? (ms.earlyEdge ? `SOON ${ms.earlyEdge.tf.toUpperCase()} ~${ms.earlyEdge.eta ? ms.earlyEdge.eta.toFixed(1) : "?"}c` : `MTF ${ms.dir.toUpperCase()} ${ms.strength}%`) : "Loading…";
            }
            return "Active";
          };

          this.el.fxPopoverList.innerHTML = "";
          INDICATOR_META.forEach((m) => {
            const on = cfg[m.key].enabled;
            const row = document.createElement("div");
            row.className = "fx-pop-row" + (on ? "" : " off");
            row.innerHTML = `
              <div class="fx-pop-left"><span class="fx-pop-name">${m.tab}</span><span class="fx-pop-val">${getVal(m.key)}</span></div>
              <div class="fx-pop-actions">
                <button class="mini-icon-btn" data-eye="${m.key}">${on ? "👁" : "⊘"}</button>
                <button class="mini-icon-btn" data-gear="${m.key}">⚙</button>
              </div>`;
            row.querySelector("[data-eye]").addEventListener("click", () => { cfg[m.key].enabled = !cfg[m.key].enabled; TV.ConfigStore.save(); this.actions.recompute(); this.renderPopover(idx); });
            row.querySelector("[data-gear]").addEventListener("click", () => { this.el.fxPopover.classList.add("hidden"); this.openSettings(m.key); });
            this.el.fxPopoverList.appendChild(row);
          });
        }

        openSheet(sheetId) { this.closeSheets(); this.el.sheetBackdrop.classList.remove("hidden"); this.el[sheetId].classList.remove("hidden"); }
        closeSheets() { this.el.sheetBackdrop.classList.add("hidden"); this.el.symbolSheet.classList.add("hidden"); this.el.settingsSheet.classList.add("hidden"); }

        renderSymbolSheet() {
          const cfg = TV.ConfigStore.data;
          this.el.symbolChipGrid.innerHTML = "";
          TV.ConfigStore.SYMBOLS.forEach((s) => {
            const btn = document.createElement("button");
            btn.className = "chip-btn" + (cfg.symbol === s.id ? " active" : "");
            btn.textContent = `${s.icon} ${s.short}`;
            btn.addEventListener("click", () => { cfg.symbol = s.id; TV.ConfigStore.save(); this.renderSymbolSheet(); this.updateSymbolHeader(); this.closeSheets(); this.actions.loadSymbol(cfg.symbol, cfg.timeframe); });
            this.el.symbolChipGrid.appendChild(btn);
          });
          this.el.tfChipGrid.innerHTML = "";
          TV.ConfigStore.TIMEFRAMES.forEach((tf) => {
            const btn = document.createElement("button");
            btn.className = "chip-btn" + (cfg.timeframe === tf ? " active" : "");
            btn.textContent = tf;
            btn.addEventListener("click", () => { cfg.timeframe = tf; TV.ConfigStore.save(); this.renderSymbolSheet(); this.updateSymbolHeader(); this.closeSheets(); this.actions.loadSymbol(cfg.symbol, cfg.timeframe); });
            this.el.tfChipGrid.appendChild(btn);
          });
        }

        openSettings(tabKey) { this.activeTab = tabKey || "ALL"; this.renderSettingsTabs(); this.renderSettingsBody(); this.openSheet("settingsSheet"); }

        renderSettingsTabs() {
          const tabs = [{ key: "ALL", tab: "ALL" }].concat(INDICATOR_META);
          this.el.settingsTabs.innerHTML = "";
          tabs.forEach((t) => {
            const btn = document.createElement("button");
            btn.className = "tab-pill" + (this.activeTab === t.key ? " active" : "");
            btn.textContent = t.tab;
            btn.addEventListener("click", () => { this.activeTab = t.key; this.renderSettingsTabs(); this.renderSettingsBody(); });
            this.el.settingsTabs.appendChild(btn);
          });
        }

        addToggle(parent, label, sub, value, onChange) {
          const row = document.createElement("div"); row.className = "setting-row";
          row.innerHTML = `<div><div class="setting-label">${label}</div>${sub ? `<div class="setting-sub">${sub}</div>` : ""}</div><label class="switch"><input type="checkbox" ${value ? "checked" : ""}><span class="slider"></span></label>`;
          row.querySelector("input").addEventListener("change", (e) => { onChange(e.target.checked); TV.ConfigStore.save(); this.actions.recompute(); });
          parent.appendChild(row);
        }

        addNumber(parent, label, value, min, max, step, onChange) {
          const row = document.createElement("div"); row.className = "setting-row";
          row.innerHTML = `<div class="setting-label">${label}</div><div class="setting-control"><input class="setting-input" type="number" value="${value}" min="${min}" max="${max}" step="${step}" /></div>`;
          row.querySelector("input").addEventListener("change", (e) => { const v = parseFloat(e.target.value); if (isFinite(v)) { onChange(Math.max(min, Math.min(max, v))); TV.ConfigStore.save(); this.actions.recompute(); } });
          parent.appendChild(row);
        }

        addSelect(parent, label, value, options, onChange) {
          const row = document.createElement("div"); row.className = "setting-row";
          row.innerHTML = `<div class="setting-label">${label}</div><select class="setting-select">${options.map((o) => `<option value="${o.v}" ${o.v === value ? "selected" : ""}>${o.l}</option>`).join("")}</select>`;
          row.querySelector("select").addEventListener("change", (e) => { onChange(e.target.value); TV.ConfigStore.save(); this.actions.recompute(); });
          parent.appendChild(row);
        }

        addColor(parent, label, value, onChange) {
          const row = document.createElement("div"); row.className = "setting-row";
          row.innerHTML = `<div class="setting-label">${label}</div><input class="setting-input" type="color" value="${value}" />`;
          row.querySelector("input").addEventListener("input", (e) => { onChange(e.target.value); TV.ConfigStore.save(); this.state.needsRender = true; });
          parent.appendChild(row);
        }

        renderSettingsBody() {
          const body = this.el.settingsBody, cfg = TV.ConfigStore.data;
          body.innerHTML = "";
          if (this.activeTab === "ALL") {
            const zipBanner = document.createElement("button");
            zipBanner.className = "action-btn";
            zipBanner.style.width = "100%";
            zipBanner.style.marginBottom = "10px";
            zipBanner.style.color = "#00e676";
            zipBanner.style.borderColor = "rgba(0, 230, 118, 0.45)";
            zipBanner.style.background = "rgba(8, 153, 129, 0.14)";
            zipBanner.textContent = "⬇ Download Separate HTML, CSS & JS (.zip for GitHub)";
            zipBanner.addEventListener("click", () => {
              if (TV.exportGitHubZip) TV.exportGitHubZip();
            });
            body.appendChild(zipBanner);

            const acts = document.createElement("div"); acts.className = "master-actions";
            acts.innerHTML = `<button class="action-btn" id="btnShowAll">Show All</button><button class="action-btn" id="btnHideAll">Hide All</button><button class="action-btn danger" id="btnResetAll">Reset All</button>`;
            body.appendChild(acts);
            acts.querySelector("#btnShowAll").addEventListener("click", () => { INDICATOR_META.forEach((m) => (cfg[m.key].enabled = true)); TV.ConfigStore.save(); this.actions.recompute(); this.renderSettingsBody(); });
            acts.querySelector("#btnHideAll").addEventListener("click", () => { INDICATOR_META.forEach((m) => (cfg[m.key].enabled = false)); TV.ConfigStore.save(); this.actions.recompute(); this.renderSettingsBody(); });
            acts.querySelector("#btnResetAll").addEventListener("click", () => { TV.ConfigStore.resetSection(null); this.applyCleanMode(); this.actions.recompute(); this.renderSettingsBody(); });

            INDICATOR_META.forEach((m) => {
              const card = document.createElement("div"); card.className = "master-card";
              card.innerHTML = `<div class="master-card-info"><div class="master-card-title">${m.title}</div><div class="master-card-sub">${m.desc}</div></div><div class="master-card-right"><button class="tune-btn">Tune</button><label class="switch"><input type="checkbox" ${cfg[m.key].enabled ? "checked" : ""}><span class="slider"></span></label></div>`;
              card.querySelector(".tune-btn").addEventListener("click", () => { this.activeTab = m.key; this.renderSettingsTabs(); this.renderSettingsBody(); });
              card.querySelector("input").addEventListener("change", (e) => { cfg[m.key].enabled = e.target.checked; TV.ConfigStore.save(); this.actions.recompute(); });
              body.appendChild(card);
            });
            return;
          }

          const key = this.activeTab, sec = cfg[key];
          this.addToggle(body, "Enable Indicator", "", sec.enabled, (v) => (sec.enabled = v));
          if (key === "btcFlow") {
            this.addSelect(body, "Tracking Mode", sec.mode, [{ v: "TAKER", l: "Taker Flow (Exact)" }, { v: "TICK", l: "Price-Tick (Up/Down)" }], (v) => (sec.mode = v));
            this.addToggle(body, "On-Chart Buy/Sell Labels", "", sec.showLabels, (v) => (sec.showLabels = v));
            this.addToggle(body, "Split Buy/Sell Volume Bars", "", sec.showSplitVol, (v) => (sec.showSplitVol = v));
            this.addNumber(body, "Min Dominance %", sec.minDomPct, 50, 95, 1, (v) => (sec.minDomPct = v));
            this.addColor(body, "Buy Color", sec.buyColor, (v) => (sec.buyColor = v));
            this.addColor(body, "Sell Color", sec.sellColor, (v) => (sec.sellColor = v));
          } else if (key === "absCvd") {
            this.addToggle(body, "Show ABS ↑ / ABS ↓ Badges", "", sec.showMarkers, (v) => (sec.showMarkers = v));
            this.addToggle(body, "Candle Absorption Halo", "", sec.showHalo, (v) => (sec.showHalo = v));
            this.addToggle(body, "Bottom CVD Sub-Pane", "", sec.showSubPane, (v) => (sec.showSubPane = v));
            this.addToggle(body, "High-Probability RSI Filter", "", sec.rsiFilter, (v) => (sec.rsiFilter = v));
            this.addNumber(body, "Volume Spike Multiplier", sec.volMult, 1.0, 5.0, 0.1, (v) => (sec.volMult = v));
            this.addColor(body, "CVD Line Color", sec.cvdColor, (v) => (sec.cvdColor = v));
          } else if (key === "rsi") {
            this.addNumber(body, "RSI Period", sec.period, 2, 50, 1, (v) => (sec.period = v));
            this.addToggle(body, "Show RSI Moving Average", "", sec.showMa, (v) => (sec.showMa = v));
            this.addNumber(body, "Overbought Level", sec.ob, 55, 90, 1, (v) => (sec.ob = v));
            this.addNumber(body, "Oversold Level", sec.os, 10, 45, 1, (v) => (sec.os = v));
          } else if (key === "vwapEma") {
            this.addToggle(body, "Session VWAP", "", sec.showVwap, (v) => (sec.showVwap = v));
            this.addToggle(body, "VWAP ±1σ Bands", "", sec.showBands, (v) => (sec.showBands = v));
            this.addNumber(body, "Fast EMA", sec.emaFast, 2, 200, 1, (v) => (sec.emaFast = v));
            this.addNumber(body, "Slow EMA", sec.emaSlow, 5, 300, 1, (v) => (sec.emaSlow = v));
          } else if (key === "srLevels") {
            this.addNumber(body, "Pivot Lookback", sec.pivotLen, 3, 20, 1, (v) => (sec.pivotLen = v));
            this.addNumber(body, "Max Active Zones", sec.maxZones, 1, 8, 1, (v) => (sec.maxZones = v));
            this.addToggle(body, "Show Touch Counts", "", sec.showLabels, (v) => (sec.showLabels = v));
          } else if (key === "macd") {
            this.addNumber(body, "Fast Length", sec.fast, 2, 50, 1, (v) => (sec.fast = v));
            this.addNumber(body, "Slow Length", sec.slow, 5, 100, 1, (v) => (sec.slow = v));
            this.addNumber(body, "Signal Smoothing", sec.signal, 2, 50, 1, (v) => (sec.signal = v));
          } else if (key === "structure") {
            this.addNumber(body, "Swing Length", sec.swingLen, 2, 12, 1, (v) => (sec.swingLen = v));
            this.addToggle(body, "Show HH/HL/LH/LL", "", sec.showSwings, (v) => (sec.showSwings = v));
            this.addToggle(body, "Show BOS Lines", "", sec.showBos, (v) => (sec.showBos = v));
          } else if (key === "smcPro") {
            this.addNumber(body, "Swing Sensitivity", sec.swingLen, 2, 10, 1, (v) => (sec.swingLen = v));
            this.addToggle(body, "CHoCH Lines", "", sec.showChoch, (v) => (sec.showChoch = v));
            this.addToggle(body, "Liquidity Zones (BSL/SSL/EQ)", "", sec.showLiq, (v) => (sec.showLiq = v));
            this.addToggle(body, "Liquidity Sweeps", "", sec.showSweeps, (v) => (sec.showSweeps = v));
            this.addToggle(body, "Order Blocks", "", sec.showOb, (v) => (sec.showOb = v));
            this.addToggle(body, "Smart Money Entries", "", sec.showEntries, (v) => (sec.showEntries = v));
          } else if (key === "patterns") {
            this.addNumber(body, "Pivot Sensitivity", sec.swingLen, 2, 8, 1, (v) => (sec.swingLen = v));
            this.addToggle(body, "W / M Patterns", "", sec.showWM, (v) => (sec.showWM = v));
            this.addToggle(body, "Triangles & Wedges", "", sec.showTriangles, (v) => (sec.showTriangles = v));
            this.addToggle(body, "Head & Shoulders", "", sec.showHS, (v) => (sec.showHS = v));
            this.addToggle(body, "Projected TP Targets", "", sec.showTargets, (v) => (sec.showTargets = v));
          } else if (key === "mtfMacd") {
            this.addToggle(body, "Bottom MTF Strip (Low-Noise)", "Shows 1m·5m·15m·4h status below chart", sec.showBottomStrip, (v) => { sec.showBottomStrip = v; this.updateMtfStrip(); });
            this.addToggle(body, "Main Chart Pre-Cross Marker", "Minimal badge on latest candle only", sec.showChartMarkers, (v) => (sec.showChartMarkers = v));
            this.addNumber(body, "MACD Fast / Slow / Sig", sec.fast, 3, 50, 1, (v) => { sec.fast = v; this.actions.recomputeMtf(); });
            this.addNumber(body, "Imminent Max Dist (%)", sec.imminentDist, 5, 45, 1, (v) => { sec.imminentDist = v; this.actions.recomputeMtf(); });
            this.addNumber(body, "Imminent Max ETA (Candles)", sec.imminentEta, 1, 10, 0.5, (v) => { sec.imminentEta = v; this.actions.recomputeMtf(); });
            this.addNumber(body, "Pre-Cross Min Angle (°)", sec.minAngle, 2, 30, 1, (v) => { sec.minAngle = v; this.actions.recomputeMtf(); });
            this.addToggle(body, "Anti-Whipsaw Curvature Filter", "", sec.accelFilter, (v) => { sec.accelFilter = v; this.actions.recomputeMtf(); });

            const openLabBtn = document.createElement("button");
            openLabBtn.className = "action-btn";
            openLabBtn.style.marginTop = "10px";
            openLabBtn.style.width = "100%";
            openLabBtn.style.color = "#00d4ff";
            openLabBtn.textContent = "Open Full MTF MACD Matrix Page ↗";
            openLabBtn.addEventListener("click", () => this.openMtfPage());
            body.appendChild(openLabBtn);
          }

          const rst = document.createElement("button");
          rst.className = "reset-tab-btn";
          rst.textContent = "Reset This Indicator to Defaults";
          rst.addEventListener("click", () => { TV.ConfigStore.resetSection(key); this.actions.recompute(); this.renderSettingsBody(); });
          body.appendChild(rst);
        }
      }

      TV.UIController = UIController;
    })(window.TVChart);

(function (TV) {
      let cleanAppMarkup = "";

      // Standard IEEE 802.3 CRC-32 for zero-dependency ZIP generation
      const CRC_TABLE = (function () {
        const t = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
          let c = i;
          for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
          t[i] = c >>> 0;
        }
        return t;
      })();

      function crc32(bytes) {
        let c = 0xffffffff;
        for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
        return (c ^ 0xffffffff) >>> 0;
      }

      function buildZipBlob(files) {
        const enc = new TextEncoder();
        const localParts = [];
        const centralParts = [];
        let offset = 0;

        files.forEach((f) => {
          const nameBytes = enc.encode(f.name);
          const dataBytes = enc.encode(f.content);
          const crc = crc32(dataBytes);

          const lh = new ArrayBuffer(30 + nameBytes.length);
          const lv = new DataView(lh);
          lv.setUint32(0, 0x04034b50, true);
          lv.setUint16(4, 20, true);
          lv.setUint16(6, 0x0800, true);
          lv.setUint16(8, 0, true);
          lv.setUint16(10, 0, true);
          lv.setUint16(12, 0x5421, true);
          lv.setUint32(14, crc, true);
          lv.setUint32(18, dataBytes.length, true);
          lv.setUint32(22, dataBytes.length, true);
          lv.setUint16(26, nameBytes.length, true);
          lv.setUint16(28, 0, true);
          new Uint8Array(lh, 30).set(nameBytes);
          localParts.push(new Uint8Array(lh), dataBytes);

          const ch = new ArrayBuffer(46 + nameBytes.length);
          const cv = new DataView(ch);
          cv.setUint32(0, 0x02014b50, true);
          cv.setUint16(4, 20, true);
          cv.setUint16(6, 20, true);
          cv.setUint16(8, 0x0800, true);
          cv.setUint16(10, 0, true);
          cv.setUint16(12, 0, true);
          cv.setUint16(14, 0x5421, true);
          cv.setUint32(16, crc, true);
          cv.setUint32(20, dataBytes.length, true);
          cv.setUint32(24, dataBytes.length, true);
          cv.setUint16(28, nameBytes.length, true);
          cv.setUint16(30, 0, true);
          cv.setUint16(32, 0, true);
          cv.setUint16(34, 0, true);
          cv.setUint16(36, 0, true);
          cv.setUint32(38, 0, true);
          cv.setUint32(42, offset, true);
          new Uint8Array(ch, 46).set(nameBytes);
          centralParts.push(new Uint8Array(ch));

          offset += 30 + nameBytes.length + dataBytes.length;
        });

        const cdSize = centralParts.reduce((s, p) => s + p.length, 0);
        const eocd = new ArrayBuffer(22);
        const ev = new DataView(eocd);
        ev.setUint32(0, 0x06054b50, true);
        ev.setUint16(4, 0, true);
        ev.setUint16(6, 0, true);
        ev.setUint16(8, files.length, true);
        ev.setUint16(10, files.length, true);
        ev.setUint32(12, cdSize, true);
        ev.setUint32(16, offset, true);
        ev.setUint16(20, 0, true);

        return new Blob(localParts.concat(centralParts, [new Uint8Array(eocd)]), { type: "application/zip" });
      }

      TV.exportGitHubZip = function () {
        try {
          const styleEl = document.querySelector("head style");
          const cssText = styleEl ? styleEl.textContent.trim() : "";
          const scriptBlocks = Array.from(document.querySelectorAll("body script"))
            .map((s) => s.textContent.trim())
            .filter(Boolean);
          const jsText = scriptBlocks.join("\n\n");

          const htmlText = [
            "<!DOCTYPE html>",
            '<html lang="en">',
            "<head>",
            '  <meta charset="UTF-8" />',
            '  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />',
            '  <meta name="apple-mobile-web-app-capable" content="yes" />',
            '  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />',
            "  <title>TradingView Mobile Pro Chart + AI Analyzer & Paper Bot</title>",
            '  <link rel="stylesheet" href="styles.css" />',
            "</head>",
            "<body>",
            cleanAppMarkup || document.getElementById("app").outerHTML,
            '  <script src="script.js"></' + "script>",
            "</body>",
            "</html>"
          ].join("\n");

          const readmeText = [
            "# TradingView Mobile Pro Chart (GitHub Pages Ready)",
            "",
            "## Files",
            "- `index.html` — Main HTML layout",
            "- `styles.css` — Mobile TradingView dark theme & MTF MACD Matrix styles",
            "- `script.js` — Live Binance feed, 10 indicators (including MTF Predictive MACD), AI Analyzer, Paper Trading & Auto-Bot",
            "",
            "## How to Host on GitHub Pages",
            "1. Unzip all files into your repository root.",
            "2. Commit and push `index.html`, `styles.css`, and `script.js`.",
            "3. Go to Repository Settings -> Pages -> Deploy from main branch (root)."
          ].join("\n");

          const blob = buildZipBlob([
            { name: "index.html", content: htmlText },
            { name: "styles.css", content: cssText },
            { name: "script.js", content: jsText },
            { name: "README.md", content: readmeText }
          ]);

          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "tradingview-mobile-pro-chart.zip";
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }, 1500);
        } catch (err) {
          const toast = document.getElementById("statusToast");
          if (toast) {
            toast.textContent = "ZIP export failed: " + err.message;
            toast.classList.remove("hidden");
            setTimeout(() => toast.classList.add("hidden"), 3000);
          }
        }
      };

      function initApp() {
        try {
          const appEl = document.getElementById("app");
          if (appEl && !cleanAppMarkup) cleanAppMarkup = appEl.outerHTML;

          TV.ConfigStore.load();
          TV.PaperBotEngine.load();
          const cfg = TV.ConfigStore.data;

          const state = {
            candles: [],
            indicators: {},
            mtf: null,
            analysis: null,
            view: { spacing: 11, rightOffset: 6, autoFit: true, minPrice: 0, maxPrice: 1 },
            crosshair: { active: false, locked: false, idx: 0, y: 0 },
            needsRender: true
          };

          const canvas = document.getElementById("chartCanvas");
          const renderer = new TV.CanvasRenderer(canvas, state);

          let lastComputeMs = 0;
          function recomputeAll(force) {
            const now = Date.now();
            if (!force && now - lastComputeMs < 200) return;
            lastComputeMs = now;
            const c = TV.ConfigStore.data;
            state.indicators = TV.IndicatorEngine.computeAll(state.candles, c);
            state.analysis = TV.TradeAnalyzer.analyze(state.candles, state.indicators, c, state.mtf);
            if (state.candles.length) {
              TV.PaperBotEngine.onTick(c.symbol, state.candles[state.candles.length - 1].close, state.analysis, state.mtf);
            }
            state.needsRender = true;
            ui.updateHUD();
            ui.updateMtfStrip();
          }

          const mtfEngine = new TV.MtfMacdEngine((snapshot) => {
            state.mtf = snapshot;
            const c = TV.ConfigStore.data;
            if (state.candles.length) {
              state.analysis = TV.TradeAnalyzer.analyze(state.candles, state.indicators, c, state.mtf);
              TV.PaperBotEngine.onTick(c.symbol, state.candles[state.candles.length - 1].close, state.analysis, state.mtf);
            }
            state.needsRender = true;
            ui.updateMtfStrip();
            ui.updateAnalyzerBar();
          });

          const actions = {
            recompute: () => {
              mtfEngine.recompute(TV.ConfigStore.data.mtfMacd);
              recomputeAll(true);
            },
            recomputeMtf: () => {
              mtfEngine.recompute(TV.ConfigStore.data.mtfMacd);
              recomputeAll(true);
            },
            loadSymbol: (sym, tf) => {
              state.view.rightOffset = 6; state.view.autoFit = true; ui.setAutoFitUI(true);
              dataEngine.loadSymbol(sym, tf);
              mtfEngine.start(sym);
            },
            setAutoFit: (val) => { state.view.autoFit = val; ui.setAutoFitUI(val); state.needsRender = true; },
            resetView: () => { state.view.spacing = 11; state.view.rightOffset = 6; state.view.autoFit = true; ui.setAutoFitUI(true); state.needsRender = true; },
            jumpLatest: () => { state.view.rightOffset = 6; state.needsRender = true; }
          };

          const ui = new TV.UIController(state, actions);

          const dataEngine = new TV.DataEngine({
            onStatus: (s, msg) => ui.setStatus(s, msg),
            onData: (candles) => {
              state.candles = candles;
              mtfEngine.syncActiveTimeframe(TV.ConfigStore.data.timeframe, candles, TV.ConfigStore.data.mtfMacd);
              recomputeAll(true);
            },
            onOlderData: () => recomputeAll(true),
            onTick: (candles) => {
              state.candles = candles;
              mtfEngine.syncActiveTimeframe(TV.ConfigStore.data.timeframe, candles, TV.ConfigStore.data.mtfMacd);
              recomputeAll(false);
              state.needsRender = true;
            }
          });

          const touch = new TV.TouchController(canvas, renderer, state, {
            onAutoFitChange: (val) => ui.setAutoFitUI(val),
            onToggleAutoFit: (val) => actions.setAutoFit(val),
            onResetZoom: () => actions.resetView(),
            onCrosshairChange: () => ui.updateHUD(),
            onNeedOlder: () => dataEngine.loadOlder()
          });

          let lastSec = 0;
          function frame() {
            touch.stepInertia();
            const sec = Math.floor(Date.now() / 1000);
            if (sec !== lastSec) { lastSec = sec; state.needsRender = true; }
            if (state.needsRender) { state.needsRender = false; renderer.render(); }
            requestAnimationFrame(frame);
          }

          dataEngine.loadSymbol(cfg.symbol, cfg.timeframe);
          mtfEngine.start(cfg.symbol);
          requestAnimationFrame(frame);
        } catch (err) {
          const toast = document.getElementById("statusToast");
          if (toast) {
            toast.textContent = "Startup error: " + err.message;
            toast.classList.remove("hidden");
          }
        }
      }

      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initApp);
      else initApp();
    })(window.TVChart);