/**
 * 本地 API 处理器
 * 纯函数，不依赖 Express，避免消费 request body 或干扰代理
 */
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { queryOne, queryAll, run, getDbSync, saveDb } = require('../db/queries');
const { signToken } = require('../middleware/auth');
const config = require('../config');
const getIsDisplayConfig = require('../data/get-is-display');

// 路由匹配表
const routes = {
  'POST': {
    '/exchange/user': handleUserInfo,
    '/exchange/user/login': handleLogin,
    '/exchange/user/register': handleRegister,
    '/exchange/user/walletLogin': handleWalletLogin,
    '/exchange/user/walletRegister': handleWalletLogin,
    '/exchange/getFile': handleGetFile,
    '/exchange/stats': handleStats,
    '/exchange/user/getUserInfo': handleGetUserInfo,
    '/exchange/user/getInfo': handleGetUserInfo,  // 添加 getInfo 端点
    '/user/getInfo': handleGetUserInfo,  // 不含 /exchange 前缀的匹配
    '/exchange/user/updateUserInfo': handleUpdateUserInfo,
    '/exchange/user/updatePassword': handleUpdatePassword,
    '/exchange/user/forgetPassword': () => ({ code: 200, data: null, msg: 'success' }),
    '/exchange/user/updateTransactionPsw': handleUpdateTxPsw,
    '/exchange/user/verificationPassword': handleVerifyTxPsw,
    '/exchange/user/userLogout': () => ({ code: 200, data: null, msg: 'success' }),
    '/exchange/user/getGoogleCode': () => ({ code: 200, data: { secret: '', qrUrl: '' }, msg: 'success' }),
    '/exchange/user/verifyGoogleCode': () => ({ code: 200, data: true, msg: 'success' }),
    '/exchange/user/myInvite': handleMyInvite,
    '/exchange/user/changeDark': () => ({ code: 200, data: null, msg: 'success' }),
    '/exchange/user/getUserKyc': () => ({ code: 200, data: { status: 0, level: 1 }, msg: 'success' }),
    '/exchange/user/dummyRegister': handleRegister,
    '/exchange/user/dellogin': () => ({ code: 200, data: null, msg: 'success' }),
    '/exchange/user/getUserName': handleGetUserInfo,
    '/exchange/user/addRessLogin': handleWalletLogin,
    '/exchange/user/addRessRegister': handleWalletLogin,
    '/exchange/user/getUserAddress': () => ({ code: 200, data: [], msg: 'success' }),
    '/exchange/user/getEmailCode': () => ({ code: 200, data: null, msg: 'success' }),
    '/exchange/user/getPhoneCode': () => ({ code: 200, data: null, msg: 'success' }),
    '/exchange/user/myAward': () => ({ code: 200, data: [], msg: 'success' }),
    '/exchange/user/myPassword': () => ({ code: 200, data: null, msg: 'success' }),
    '/exchange/user/code': () => ({ code: 200, data: null, msg: 'success' }),
    '/exchange/user/updateEmail': () => ({ code: 200, data: null, msg: 'success' }),
    '/exchange/user/updatePhone': () => ({ code: 200, data: null, msg: 'success' }),
    '/exchange/user/updateTransactionPassword': handleUpdateTxPsw,
    '/exchange/user/userEmAndPh': () => ({ code: 200, data: null, msg: 'success' }),
    '/exchange/user/getVerificationCode': () => ({ code: 200, data: null, msg: 'success' }),

    '/exchange/wallet/getUserWallet': handleGetUserWallet,
    '/exchange/wallet/getTotalAssets': handleGetTotalAssets,
    '/exchange/wallet/getStockTotalAssets': () => ({ code: 200, data: { totalAssets: '0.00' }, msg: 'success' }),
    '/exchange/wallet/getWalletHistory': handleGetWalletHistory,
    '/exchange/wallet/userFlowRecord': handleGetWalletHistory,
    '/exchange/wallet/transferWallet': handleTransferWallet,
    '/exchange/wallet/convertSymbol': handleConvertSymbol,
    '/exchange/wallet/purchaseProductRecord': () => ({ code: 200, data: { content: { records: [], total: 0, size: 10, current: 1, pages: 0 } }, msg: 'success' }),
    '/exchange/wallet/getUserTypeWallet': handleGetUserWallet,
    '/exchange/wallet/getUserStockWallet': () => ({ code: 200, data: [], msg: 'success' }),
    // ========== 充值/提现 ==========
    '/exchange/wallet/recharge/apply': handleRechargeApply,
    '/exchange/wallet/recharge/list': handleRechargeList,
    '/exchange/wallet/withdraw/apply': handleWithdrawApply,
    '/exchange/wallet/withdraw/list': handleWithdrawList,

    '/exchange/rockieCoin/coinBuy': handleCoinBuy,
    '/exchange/rockieCoin/coinFee': () => ({ code: 200, data: { spotFee: config.FEE_RATE * 100 + '%', futuresFee: config.FEE_RATE_FUTURES * 100 + '%' }, msg: 'success' }),
    '/exchange/rockieCoin/getPrice': handleGetPrice,
    '/exchange/rockieCoin/list': handleCoinList,
    '/exchange/rockieCoin/getAvgPrice': () => ({ code: 200, data: {}, msg: 'success' }),
    '/exchange/rockieCoin/getBookTicker': () => ({ code: 200, data: {}, msg: 'success' }),
    '/exchange/rockieCoin/getDepth': () => ({ code: 200, data: [], msg: 'success' }),
    '/exchange/rockieCoin/getHistoricalTrades': () => ({ code: 200, data: [], msg: 'success' }),
    '/exchange/rockieCoin/getKlines': () => ({ code: 200, data: [], msg: 'success' }),
    '/exchange/rockieCoin/getMergeKLines': () => ({ code: 200, data: [], msg: 'success' }),
    '/exchange/rockieCoin/getTradeDone': handleTransactionCurrency,
    '/exchange/rockieCoin/getTradeUndone': () => ({ code: 200, data: { content: { records: [], total: 0, size: 10, current: 1, pages: 0 } }, msg: 'success' }),
    '/exchange/rockieCoin/getTwentyFourHr': () => ({ code: 200, data: [], msg: 'success' }),
    '/exchange/rockieCoin/revoke': () => ({ code: 200, data: null, msg: 'success' }),

    '/exchange/rockieCoinFutures/futuresBuy': handleFuturesBuy,
    '/exchange/rockieCoinFutures/futuresClose': handleFuturesClose,
    '/exchange/rockieCoinFutures/close': handleFuturesClose,
    '/exchange/rockieCoinFutures/getAvgPrice': () => ({ code: 200, data: {}, msg: 'success' }),
    '/exchange/rockieCoinFutures/getBookTicker': () => ({ code: 200, data: {}, msg: 'success' }),
    '/exchange/rockieCoinFutures/getDepth': () => ({ code: 200, data: [], msg: 'success' }),
    '/exchange/rockieCoinFutures/getHistoricalTrades': () => ({ code: 200, data: [], msg: 'success' }),
    '/exchange/rockieCoinFutures/getKlines': () => ({ code: 200, data: [], msg: 'success' }),
    '/exchange/rockieCoinFutures/getMergeKLines': () => ({ code: 200, data: [], msg: 'success' }),
    '/exchange/rockieCoinFutures/getPrice': handleGetPrice,
    '/exchange/rockieCoinFutures/getTradeDone': () => ({ code: 200, data: { content: { records: [], total: 0, size: 10, current: 1, pages: 0 } }, msg: 'success' }),
    '/exchange/rockieCoinFutures/getTradeUndone': () => ({ code: 200, data: { content: { records: [], total: 0, size: 10, current: 1, pages: 0 } }, msg: 'success' }),
    '/exchange/rockieCoinFutures/getTwentyFourHr': () => ({ code: 200, data: [], msg: 'success' }),
    '/exchange/rockieCoinFutures/list': handleCoinList,
    '/exchange/rockieCoinFutures/revoke': () => ({ code: 200, data: null, msg: 'success' }),
    '/exchange/rockieCoinFutures/updateIsStop': () => ({ code: 200, data: null, msg: 'success' }),
    '/exchange/rockieCoinFutures/getFuturesClose': () => ({ code: 200, data: [], msg: 'success' }),
    '/exchange/rockieCoinFutures/getHisTrade': () => ({ code: 200, data: { content: { records: [], total: 0, size: 10, current: 1, pages: 0 } }, msg: 'success' }),

    // ========== Options / ETF / Stock / Gold（前端会调用，返回空数据）==========
    '/exchange/rockieCoinOptions/buy': () => ({ code: 200, data: null, msg: 'success' }),
    '/exchange/rockieCoinOptions/getHisTrade': () => ({ code: 200, data: { content: { records: [], total: 0, size: 10, current: 1, pages: 0 } }, msg: 'success' }),
    '/exchange/rockieCoinOptions/getHisTradeById': () => ({ code: 200, data: null, msg: 'success' }),
    '/exchange/rockieCoinOptions/getTradeDone': () => ({ code: 200, data: { content: { records: [], total: 0, size: 10, current: 1, pages: 0 } }, msg: 'success' }),
    '/exchange/rockieCoinOptions/optionConfig': () => ({ code: 200, data: null, msg: 'success' }),
    '/exchange/newStockCoinTrade/coinBuy': handleCoinBuy,
    '/exchange/newStockCoinTrade/getTradeDone': () => ({ code: 200, data: { content: { records: [], total: 0, size: 10, current: 1, pages: 0 } }, msg: 'success' }),
    '/exchange/newStockCoinTrade/getTradeUndone': () => ({ code: 200, data: { content: { records: [], total: 0, size: 10, current: 1, pages: 0 } }, msg: 'success' }),
    '/exchange/newStockCoinTrade/revoke': () => ({ code: 200, data: null, msg: 'success' }),
    '/exchange/rockieWalletWithdraw/getWithdrawCoin': () => ({ code: 200, data: [], msg: 'success' }),
    '/exchange/nftProduct/addNftLove': () => ({ code: 200, data: null, msg: 'success' }),
    '/exchange/productGold/getVip': () => ({ code: 200, data: [], msg: 'success' }),
    '/exchange/telegram/login': () => ({ code: 200, data: null, msg: 'success' }),

    // ========== Share ==========
    '/exchange/share/getUserLvl': () => ({ code: 200, data: { level: 0, lvlName: '' }, msg: 'success' }),
    '/exchange/share/getUserLvlNumber': () => ({ code: 200, data: [], msg: 'success' }),
    '/exchange/share/getUserRebate': () => ({ code: 200, data: { totalRebate: '0.00' }, msg: 'success' }),
    '/exchange/share/getUserRebateRecord': () => ({ code: 200, data: { content: { records: [], total: 0, size: 10, current: 1, pages: 0 } }, msg: 'success' }),
    '/exchange/share/kfUrl': () => ({ code: 200, data: { url: '' }, msg: 'success' }),

    // ========== Home / TradingView ==========
    '/exchange/Home/home': () => ({ code: 200, data: {}, msg: 'success' }),
    '/exchange/Home/pageHome': (path, body, user) => {
      const cache = global.__priceCache || {};
      const content = Object.entries(cache).map(([symbol, data]) => {
        const fromSymbol = symbol.replace(/USDT$/, '');
        const lastPrice = data.price || 0;
        const change = data.change_24h || 0;
        return {
          coinName: fromSymbol,
          fromSymbol: fromSymbol,
          toSymbol: 'USDT',
          iconUrl: '',
          lastPrice: Number(lastPrice),
          priceChange: Number((change * lastPrice / 100).toFixed(2)),
          priceChangePercentage: Number(change).toFixed(2),
          isUp: change > 0,
          rate: change > 0 ? '+' + Number(change).toFixed(2) : Number(change).toFixed(2),
          twentyFourHrResp: {
            lastPrice: Number(lastPrice),
            priceChangePercent: Number(change),
            volume: data.volume_24h || 0,
            marketCap: data.market_cap || 0,
          },
          klineRespList: [],
          klinesRespList: [],
          openPrice: Number((lastPrice / (1 + change / 100)).toFixed(2)),
        };
      });
      return { code: 200, content, msg: 'success' };
    },
    '/exchange/tradingView/types': () => ({ code: 200, data: [], msg: 'success' }),
    '/exchange/tradingView/getBtcTotal': (path, body, user) => {
      const cache = global.__priceCache || {};
      const marketStats = {};
      for (const [symbol, data] of Object.entries(cache)) {
        marketStats[symbol] = '$' + Number(data.market_cap || 0).toFixed(0);
      }
      marketStats['EUR'] = '$1,200,000,000,000';
      marketStats['GBP'] = '$3,000,000,000,000';
      marketStats['JPY'] = '$500,000,000,000';
      return { marketStats };
    },
    '/exchange/tradingView/getBtcEnd': (path, body, user) => {
      const timeframes = { '1H': {}, '4H': {}, '24H': {} };
      timeframes['1H']['BTC'] = '45.2%';
      timeframes['1H']['ETH'] = '18.7%';
      timeframes['1H']['Others'] = '36.1%';
      timeframes['4H']['BTC'] = '44.8%';
      timeframes['4H']['ETH'] = '19.1%';
      timeframes['4H']['Others'] = '36.1%';
      timeframes['24H']['BTC'] = '45.1%';
      timeframes['24H']['ETH'] = '18.9%';
      timeframes['24H']['Others'] = '36.0%';
      return { data: timeframes };
    },

    // ========== RockieNews 新闻接口 ==========
    '/exchange/RockieNews/getStockList': (path, body, user) => {
      const cache = global.__priceCache || {};
      const content = Object.entries(cache).slice(0, 20).map(([symbol, data]) => ({
        coinName: symbol.replace(/USDT$/, ''),
        toSymbol: 'USDT',
        lastPrice: data.price || 0,
        change24h: (data.change_24h || 0).toFixed(2),
        volume: data.volume_24h || 0,
        marketCap: data.market_cap || 0,
      }));
      return { code: 200, content, msg: 'success' };
    },

    // ========== Gold/ETF/Stock（前端会调用，返回空数据）==========
    '/exchange/RockieGoldETFController/list': () => ({ code: 200, data: [], msg: 'success' }),
    '/exchange/RockieGoldETFController/Tickerlist': () => ({ code: 200, data: [], msg: 'success' }),
    '/exchange/RockieGoldETFController/buy': () => ({ code: 200, data: null, msg: 'success' }),
    '/exchange/RockieGoldETFController/close': () => ({ code: 200, data: null, msg: 'success' }),
    '/exchange/RockieGoldETFController/revoke': () => ({ code: 200, data: null, msg: 'success' }),
    '/exchange/RockieGoldETFController/getTradeDone': () => ({ code: 200, data: { content: { records: [], total: 0, size: 10, current: 1, pages: 0 } }, msg: 'success' }),
    '/exchange/RockieGoldETFController/getTradeUndone': () => ({ code: 200, data: { content: { records: [], total: 0, size: 10, current: 1, pages: 0 } }, msg: 'success' }),
    '/exchange/RockieGoldETFController/getHisTrade': () => ({ code: 200, data: { content: { records: [], total: 0, size: 10, current: 1, pages: 0 } }, msg: 'success' }),
    '/exchange/RockieGoldETFController/getHisTradeById': () => ({ code: 200, data: null, msg: 'success' }),
    '/exchange/RockieGoldETFController/getEtfHisTrade': () => ({ code: 200, data: { content: { records: [], total: 0, size: 10, current: 1, pages: 0 } }, msg: 'success' }),
    '/exchange/RockieGoldETFController/getEtfTradeDone': () => ({ code: 200, data: { content: { records: [], total: 0, size: 10, current: 1, pages: 0 } }, msg: 'success' }),
    '/exchange/RockieGoldETFController/getSumNumber': () => ({ code: 200, data: {}, msg: 'success' }),
    '/exchange/RockieGoldETFController/getFuturesClose': () => ({ code: 200, data: [], msg: 'success' }),
    '/exchange/RockieGoldETFController/polygonList': () => ({ code: 200, data: [], msg: 'success' }),
    '/exchange/RockieGoldETFController/goldEtfFuturesBuy': () => ({ code: 200, data: null, msg: 'success' }),

    '/exchange/RockieGoldStockController/list': () => ({ code: 200, data: [], msg: 'success' }),
    '/exchange/RockieGoldStockController/Tickerlist': () => ({ code: 200, data: [], msg: 'success' }),
    '/exchange/RockieGoldStockController/buy': () => ({ code: 200, data: null, msg: 'success' }),
    '/exchange/RockieGoldStockController/close': () => ({ code: 200, data: null, msg: 'success' }),
    '/exchange/RockieGoldStockController/revoke': () => ({ code: 200, data: null, msg: 'success' }),
    '/exchange/RockieGoldStockController/getTradeDone': () => ({ code: 200, data: { content: { records: [], total: 0, size: 10, current: 1, pages: 0 } }, msg: 'success' }),
    '/exchange/RockieGoldStockController/getTradeUndone': () => ({ code: 200, data: { content: { records: [], total: 0, size: 10, current: 1, pages: 0 } }, msg: 'success' }),
    '/exchange/RockieGoldStockController/getHisTrade': () => ({ code: 200, data: { content: { records: [], total: 0, size: 10, current: 1, pages: 0 } }, msg: 'success' }),
    '/exchange/RockieGoldStockController/getHisTradeById': () => ({ code: 200, data: null, msg: 'success' }),
    '/exchange/RockieGoldStockController/getStockHisTrade': () => ({ code: 200, data: { content: { records: [], total: 0, size: 10, current: 1, pages: 0 } }, msg: 'success' }),
    '/exchange/RockieGoldStockController/getStockTradeDone': () => ({ code: 200, data: { content: { records: [], total: 0, size: 10, current: 1, pages: 0 } }, msg: 'success' }),
    '/exchange/RockieGoldStockController/getSumNumber': () => ({ code: 200, data: {}, msg: 'success' }),
    '/exchange/RockieGoldStockController/getFuturesClose': () => ({ code: 200, data: [], msg: 'success' }),
    '/exchange/RockieGoldStockController/goldStockFuturesBuy': () => ({ code: 200, data: null, msg: 'success' }),
    '/exchange/RockieGoldStockController/quotesList': () => ({ code: 200, data: [], msg: 'success' }),

    '/exchange/RockieGoldNewStockController/list': () => ({ code: 200, data: [], msg: 'success' }),
    '/exchange/RockieGoldNewStockController/tickerList': () => ({ code: 200, data: [], msg: 'success' }),
    '/exchange/RockieGoldNewStockController/tickerList1': () => ({ code: 200, data: [], msg: 'success' }),
    '/exchange/RockieGoldNewStockController/tickerRecommend': () => ({ code: 200, data: [], msg: 'success' }),
    '/exchange/RockieGoldNewStockController/buy': () => ({ code: 200, data: null, msg: 'success' }),
    '/exchange/RockieGoldNewStockController/close': () => ({ code: 200, data: null, msg: 'success' }),
    '/exchange/RockieGoldNewStockController/revoke': () => ({ code: 200, data: null, msg: 'success' }),
    '/exchange/RockieGoldNewStockController/getTradeDone': () => ({ code: 200, data: { content: { records: [], total: 0, size: 10, current: 1, pages: 0 } }, msg: 'success' }),
    '/exchange/RockieGoldNewStockController/getTradeUndone': () => ({ code: 200, data: { content: { records: [], total: 0, size: 10, current: 1, pages: 0 } }, msg: 'success' }),
    '/exchange/RockieGoldNewStockController/getHisTrade': () => ({ code: 200, data: { content: { records: [], total: 0, size: 10, current: 1, pages: 0 } }, msg: 'success' }),
    '/exchange/RockieGoldNewStockController/getHisTradeById': () => ({ code: 200, data: null, msg: 'success' }),
    '/exchange/RockieGoldNewStockController/getStockHisTrade': () => ({ code: 200, data: { content: { records: [], total: 0, size: 10, current: 1, pages: 0 } }, msg: 'success' }),
    '/exchange/RockieGoldNewStockController/getStockTradeDone': () => ({ code: 200, data: { content: { records: [], total: 0, size: 10, current: 1, pages: 0 } }, msg: 'success' }),
    '/exchange/RockieGoldNewStockController/getSumNumber': () => ({ code: 200, data: {}, msg: 'success' }),
    '/exchange/RockieGoldNewStockController/getFuturesClose': () => ({ code: 200, data: [], msg: 'success' }),
    '/exchange/RockieGoldNewStockController/goldStockFuturesBuy': () => ({ code: 200, data: null, msg: 'success' }),
    '/exchange/RockieGoldNewStockController/getList': () => ({ code: 200, data: [], msg: 'success' }),
    '/exchange/RockieGoldNewStockController/getMarketStatus': () => ({ code: 200, data: {}, msg: 'success' }),
    '/exchange/RockieGoldNewStockController/getPrice': () => ({ code: 200, data: {}, msg: 'success' }),
    '/exchange/RockieGoldNewStockController/getStockDetail': () => ({ code: 200, data: {}, msg: 'success' }),
    '/exchange/RockieGoldNewStockController/getTwentyFourData': () => ({ code: 200, data: [], msg: 'success' }),
    '/exchange/RockieGoldNewStockController/quotesList': () => ({ code: 200, data: [], msg: 'success' }),

    '/exchange/RockieGoldIndiceController/tickerList': () => ({ code: 200, data: [], msg: 'success' }),

    '/exchange/goldForeign/list': () => ({ code: 200, data: [], msg: 'success' }),
    '/exchange/goldForeign/Tickerlist': () => ({ code: 200, data: [], msg: 'success' }),
    '/exchange/goldForeign/buy': () => ({ code: 200, data: null, msg: 'success' }),
    '/exchange/goldForeign/close': () => ({ code: 200, data: null, msg: 'success' }),
    '/exchange/goldForeign/revoke': () => ({ code: 200, data: null, msg: 'success' }),
    '/exchange/goldForeign/getHisTrade': () => ({ code: 200, data: { content: { records: [], total: 0, size: 10, current: 1, pages: 0 } }, msg: 'success' }),
    '/exchange/goldForeign/getHisTradeById': () => ({ code: 200, data: null, msg: 'success' }),
    '/exchange/goldForeign/getSumNumber': () => ({ code: 200, data: {}, msg: 'success' }),
    '/exchange/goldForeign/getTradeUndone': () => ({ code: 200, data: { content: { records: [], total: 0, size: 10, current: 1, pages: 0 } }, msg: 'success' }),
    '/exchange/goldForeign/getForeignTradeDone': () => ({ code: 200, data: { content: { records: [], total: 0, size: 10, current: 1, pages: 0 } }, msg: 'success' }),
    '/exchange/goldForeign/getGoldOptionsHisTrade': () => ({ code: 200, data: { content: { records: [], total: 0, size: 10, current: 1, pages: 0 } }, msg: 'success' }),
    '/exchange/goldForeign/getGoldOptionsTradeDone': () => ({ code: 200, data: { content: { records: [], total: 0, size: 10, current: 1, pages: 0 } }, msg: 'success' }),
    '/exchange/goldForeign/getFuturesClose': () => ({ code: 200, data: [], msg: 'success' }),
    '/exchange/goldForeign/goldFuturesBuy': () => ({ code: 200, data: null, msg: 'success' }),
    '/exchange/goldForeign/quotesList': () => ({ code: 200, data: [], msg: 'success' }),

    // ========== RockieMessage（除了 getValue 之外的前端调用）==========
    '/exchange/RockieMessage/getServeMy': () => [],
    '/exchange/RockieMessage/getTransactionList': () => ({ code: 200, data: [], msg: 'success' }),
    '/exchange/RockieMessage/getNotify': () => ({ code: 200, data: [], msg: 'success' }),
    '/exchange/RockieMessage/getDict': (path, body, user) => {
      // 前端 splice(0,0,...n) 需要 n 是数组，不能包在 {code, data} 里
      return [
        { value: 'en', label: 'English' },
        { value: 'zh', label: '中文' },
        { value: 'ko', label: '한국어' },
        { value: 'ja', label: '日本語' },
        { value: 'vi', label: 'Tiếng Việt' },
        { value: 'th', label: 'ภาษาไทย' },
        { value: 'tr', label: 'Türkçe' },
      ];
    },
    '/exchange/RockieMessage/getPlayIcon': () => ({ code: 200, data: null, msg: 'success' }),
    '/exchange/RockieMessage/getPlayIconList': () => ({ code: 200, data: [], msg: 'success' }),
    '/exchange/RockieMessage/getServe': () => ({ code: 200, data: null, msg: 'success' }),
    '/exchange/RockieMessage/getNotifyNumber': () => ({ code: 200, data: 0, msg: 'success' }),
    '/exchange/RockieMessage/getPopNotify': () => ({ code: 200, data: null, msg: 'success' }),
    '/exchange/RockieMessage/addNotify': () => ({ code: 200, data: null, msg: 'success' }),
    '/exchange/RockieMessage/addNotifyRead': () => ({ code: 200, data: null, msg: 'success' }),
    '/exchange/RockieMessage/delNotify': () => ({ code: 200, data: null, msg: 'success' }),
    '/exchange/RockieAiController/login': () => ({ code: 200, data: null, msg: 'success' }),
    '/exchange/RockieAiController/transfer': () => ({ code: 200, data: null, msg: 'success' }),
    '/exchange/rockieFile/uploadFile': () => ({ code: 200, data: { url: '' }, msg: 'success' }),

    '/exchange/Transaction/currency': handleTransactionCurrency,
    '/exchange/Transaction/currency/positionDetail': handlePositionDetail,
    '/exchange/Transaction/currency/contractRecords': handleContractRecords,
    '/exchange/Transaction/new/stock': () => ({ code: 200, data: { content: { records: [], total: 0, size: 10, current: 1, pages: 0 } }, msg: 'success' }),
    '/exchange/Transaction/stock': () => ({ code: 200, data: { content: { records: [], total: 0, size: 10, current: 1, pages: 0 } }, msg: 'success' }),
    '/exchange/Transaction/forex': () => ({ code: 200, data: { content: { records: [], total: 0, size: 10, current: 1, pages: 0 } }, msg: 'success' }),
    '/exchange/Transaction/etf': () => ({ code: 200, data: { content: { records: [], total: 0, size: 10, current: 1, pages: 0 } }, msg: 'success' }),

    // ========== 用户间转账 / 资金账户 ==========
    '/exchange/transfer/user': handleTransferUser,
    '/exchange/UserInfo': () => ({ code: 200, data: {}, msg: 'success' }),
    '/exchange/Wallet': () => ({ code: 200, data: {}, msg: 'success' }),
    '/exchange/wallet': () => ({ code: 200, data: {}, msg: 'success' }),
    '/exchange/walletAccount': () => ({ code: 200, data: {}, msg: 'success' }),
    '/exchange/mobileWalletHistory': () => ({ code: 200, data: { content: { records: [], total: 0, size: 10, current: 1, pages: 0 } }, msg: 'success' }),
    '/exchange/userAgreement': () => ({ code: 200, data: '', msg: 'success' }),
    '/exchange/ws/user/queryUserUnreadList': () => ({ code: 200, data: [], msg: 'success' }),

    // ========== 大额交易 ==========
    '/exchange/largeTransactions': () => ({ code: 200, data: { content: { records: [], total: 0, size: 10, current: 1, pages: 0 } }, msg: 'success' }),
    '/exchange/largeTransactions/getList': () => ({ code: 200, data: { content: { records: [], total: 0, size: 10, current: 1, pages: 0 } }, msg: 'success' }),
    '/exchange/largeTransactions/detail': () => ({ code: 200, data: {}, msg: 'success' }),
    '/exchange/largeTransactions/record': () => ({ code: 200, data: { content: { records: [], total: 0, size: 10, current: 1, pages: 0 } }, msg: 'success' }),

    // ========== 平台配置 ==========
    '/exchange/hashMap/getIsDisplay': handleGetIsDisplay,
    '/exchange/hashMap/getValue': handleGetValue,
    '/exchange/rockieCoin/getPrice': handleGetPrice,
    '/exchange/user/myState': handleMyState,
    '/exchange/RockieMessage/getValue': handleRockieMessageGetValue,
    '/exchange/rockieFile/getFile': handleRockieFileGetFile,
  },
  'GET': {
    '/exchange/RockieMessage/getApp': handleRockieMessageGetApp,
    '/exchange/rockieFile/getFile': handleRockieFileGetFile,
    '/exchange/hashMap/getIsDisplay': handleGetIsDisplay,
    '/exchange/hashMap/getValue': handleGetValue,
    '/api/config': () => ({ code: 200, data: { siteName: 'Klakna', isDisplay: true }, msg: 'success' }),
    '/config': () => ({ code: 200, data: { siteName: 'Klakna', isDisplay: true, fileId: '9007393' }, msg: 'success' }),
  }
};

/**
 * 路由匹配 —— v4: 精确匹配 + 大小写不敏感 + 前缀兜底
 * 1. 先精确匹配
 * 2. 再尝试大小写不敏感匹配
 * 3. 未注册的路径返回空成功（避免 404 导致前端无限重试）
 */
function match(method, path) {
  const methodRoutes = routes[method];
  if (!methodRoutes) {
    // 尝试另一种方法（前端可能用 GET 调 POST 接口）
    const altMethod = method === 'GET' ? 'POST' : 'GET';
    const altRoutes = routes[altMethod];
    if (altRoutes && altRoutes[path]) return altRoutes[path];
    return null;
  }

  // 1. 精确匹配
  if (methodRoutes[path]) return methodRoutes[path];

  // 2. 大小写不敏感匹配
  const lowerPath = path.toLowerCase();
  for (const [routeKey, handler] of Object.entries(methodRoutes)) {
    if (routeKey.toLowerCase() === lowerPath) return handler;
  }

  // 3. 尝试另一种方法的大小写不敏感匹配
  const altMethod2 = method === 'GET' ? 'POST' : 'GET';
  const altRoutes2 = routes[altMethod2];
  if (altRoutes2) {
    for (const [routeKey, handler] of Object.entries(altRoutes2)) {
      if (routeKey.toLowerCase() === lowerPath) return handler;
    }
  }

  return null;
}

// ========== 用户 ==========

function handleLogin(path, body) {
  const { username, password, type } = body;
  if (type === 'wallet' || !password) {
    const addr = username;
    const user = queryOne("SELECT * FROM users WHERE wallet_address = ?", [addr]);
    if (!user) return { code: 400, data: null, msg: 'User not found' };
    return { code: 200, data: formatUser(user, signToken(user)), msg: 'success' };
  }
  const user = queryOne("SELECT * FROM users WHERE (username = ? OR email = ? OR phone = ?) AND status = 1", [username, username, username]);
  if (!user || !user.password) return { code: 400, data: null, msg: 'Invalid credentials' };
  if (!bcrypt.compareSync(password, user.password)) return { code: 400, data: null, msg: 'Invalid credentials' };
  return { code: 200, data: formatUser(user, signToken(user)), msg: 'success' };
}

function handleRegister(path, body) {
  const { username, password, type, walletAddress, inviteCode } = body;
  if (type === 'wallet' || walletAddress) {
    const existing = queryOne("SELECT id FROM users WHERE wallet_address = ?", [walletAddress]);
    if (existing) return { code: 400, data: null, msg: 'Wallet exists' };
    const code = generateCode();
    run("INSERT INTO users (wallet_address, nick_name, invite_code, invited_by) VALUES (?, ?, ?, ?)",
      [walletAddress, walletAddress.substring(0, 10), code, inviteCode || '']);
    const user = queryOne("SELECT * FROM users WHERE wallet_address = ?", [walletAddress]);
    createDefaultWallets(user.id);
    return { code: 200, data: formatUser(user, signToken(user)), msg: 'success' };
  }
  if (!username || !password) return { code: 400, data: null, msg: 'Username and password required' };
  const existing = queryOne("SELECT id FROM users WHERE username = ? OR email = ?", [username, body.email || '']);
  if (existing) return { code: 400, data: null, msg: 'User exists' };
  const hash = bcrypt.hashSync(password, 10);
  const code = generateCode();
  run("INSERT INTO users (username, password, email, phone, nick_name, invite_code, invited_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [username, hash, body.email || null, body.phone || null, username, code, inviteCode || '']);
  const user = queryOne("SELECT * FROM users WHERE username = ?", [username]);
  createDefaultWallets(user.id);
  return { code: 200, data: formatUser(user, signToken(user)), msg: 'success' };
}

function handleWalletLogin(path, body) {
  const { address } = body;
  // 🔧 前端 getGlobalConfig 也调用 /user/addRessLogin（混淆后映射错误）
  // 当没有 address 参数时，返回完整配置数据以避免前端 JSON.parse(undefined) 崩溃
  if (!address) {
    return handleRockieMessageGetValue(path, body);
  }
  if (!address) return { code: 400, data: null, msg: 'Address required' };
  let user = queryOne("SELECT * FROM users WHERE wallet_address = ?", [address]);
  if (!user) {
    const code = generateCode();
    run("INSERT INTO users (wallet_address, nick_name, invite_code) VALUES (?, ?, ?)", [address, address.substring(0, 10), code]);
    user = queryOne("SELECT * FROM users WHERE wallet_address = ?", [address]);
    createDefaultWallets(user.id);
  }
  return { code: 200, data: formatUser(user, signToken(user)), msg: 'success' };
}

function handleUserInfo(path, body, user) {
  if (!user) return { code: 200, data: null, msg: 'Not logged in' };
  return handleGetUserInfo(path, body, user);
}

function handleGetUserInfo(path, body, user) {
  if (!user) {
    // 未登录：返回空的会话信息，让前端正确处理未登录状态
    // 注意：前端期望 userId (大写I)，不是 userid
    return { code: 200, data: { userId: null, sessionId: null }, msg: 'Not logged in' };
  }
  const u = queryOne("SELECT * FROM users WHERE id = ?", [user.id]);
  if (!u) return { code: 404, data: null, msg: 'Not found' };
  const wallets = queryAll("SELECT * FROM wallets WHERE user_id = ? ORDER BY sort_order", [u.id]);
  const usdt = wallets.find(w => w.coin_symbol === 'USDT');
  const totalAssets = wallets.reduce((s, w) => s + (w.coin_symbol === 'USDT' ? w.available + w.frozen : 0), 0);
  return {
    code: 200, msg: 'success',
    data: { ...formatUser(u), token: '', balances: wallets, totalAssets: totalAssets.toFixed(2),
      availableBalance: (usdt ? usdt.available : 0).toFixed(2), freezeBalance: (usdt ? usdt.frozen : 0).toFixed(2),
      content: { records: [], total: 0, size: 10, current: 1, pages: 0 } }
  };
}

function handleUpdateUserInfo(path, body, user) {
  if (!user) return { code: 401, data: null, msg: 'Unauthorized' };
  const { nickName, avatar, email, phone } = body;
  const sets = [], params = [];
  if (nickName !== undefined) { sets.push("nick_name = ?"); params.push(nickName); }
  if (avatar !== undefined) { sets.push("avatar = ?"); params.push(avatar); }
  if (email !== undefined) { sets.push("email = ?"); params.push(email); }
  if (phone !== undefined) { sets.push("phone = ?"); params.push(phone); }
  if (sets.length) { sets.push("updated_at = datetime('now')"); params.push(user.id); run(`UPDATE users SET ${sets.join(',')} WHERE id = ?`, params); }
  return { code: 200, data: null, msg: 'success' };
}

function handleUpdatePassword(path, body, user) {
  if (!user) return { code: 401, data: null, msg: 'Unauthorized' };
  const u = queryOne("SELECT * FROM users WHERE id = ?", [user.id]);
  if (u.password && !bcrypt.compareSync(body.oldPassword, u.password)) return { code: 400, data: null, msg: 'Wrong password' };
  run("UPDATE users SET password = ?, updated_at = datetime('now') WHERE id = ?", [bcrypt.hashSync(body.newPassword, 10), user.id]);
  return { code: 200, data: null, msg: 'success' };
}

function handleUpdateTxPsw(path, body, user) {
  if (!user) return { code: 401, data: null, msg: 'Unauthorized' };
  run("UPDATE users SET trading_password = ? WHERE id = ?", [bcrypt.hashSync(body.transactionPsw || '123456', 10), user.id]);
  return { code: 200, data: null, msg: 'success' };
}

function handleVerifyTxPsw(path, body, user) {
  if (!user) return { code: 401, data: null, msg: 'Unauthorized' };
  const u = queryOne("SELECT * FROM users WHERE id = ?", [user.id]);
  if (!u.trading_password) return { code: 200, data: true, msg: 'success' };
  const valid = bcrypt.compareSync(body.transactionPsw, u.trading_password);
  return { code: 200, data: valid, msg: valid ? 'success' : 'Wrong password' };
}

function handleMyInvite(path, body, user) {
  if (!user) return { code: 200, data: { inviteCode: '', invitedCount: 0 }, msg: 'success' };
  const u = queryOne("SELECT invite_code FROM users WHERE id = ?", [user.id]);
  return { code: 200, data: { inviteCode: u?.invite_code || '', invitedCount: 0, totalReward: '0.00' }, msg: 'success' };
}

// ========== 钱包 ==========

function handleGetUserWallet(path, body, user) {
  if (!user) return { code: 200, data: [] };
  const wallets = queryAll("SELECT * FROM wallets WHERE user_id = ? ORDER BY sort_order", [user.id]);
  return { code: 200, data: wallets.map(w => ({ coinSymbol: w.coin_symbol, coinName: w.coin_name, available: w.available, frozen: w.frozen, total: w.available + w.frozen, icon: w.icon })), msg: 'success' };
}

function handleGetTotalAssets(path, body, user) {
  if (!user) return { code: 200, data: { totalAssets: '0.00', availableBalance: '0.00', freezeBalance: '0.00' } };
  const wallets = queryAll("SELECT * FROM wallets WHERE user_id = ?", [user.id]);
  const usdt = wallets.find(w => w.coin_symbol === 'USDT') || { available: 0, frozen: 0 };
  const total = wallets.reduce((s, w) => s + (w.coin_symbol === 'USDT' ? w.available + w.frozen : 0), 0);
  return { code: 200, data: { totalAssets: total.toFixed(2), availableBalance: usdt.available.toFixed(2), freezeBalance: usdt.frozen.toFixed(2) }, msg: 'success' };
}

function handleGetWalletHistory(path, body, user) {
  if (!user) return { code: 200, data: { content: { records: [], total: 0, size: 10, current: 1, pages: 0 } } };
  const { page = 1, size = 10, coinSymbol, type } = body;
  let where = "WHERE user_id = ?", params = [user.id];
  if (coinSymbol) { where += " AND coin_symbol = ?"; params.push(coinSymbol); }
  if (type) { where += " AND type = ?"; params.push(type); }
  const records = queryAll(`SELECT * FROM flow_records ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, size, (page - 1) * size]);
  const cnt = getDbSync().exec(`SELECT COUNT(*) FROM flow_records ${where}`, params);
  const total = cnt[0]?.values[0]?.[0] || 0;
  return { code: 200, data: { content: { records, total, size, current: page, pages: Math.ceil(total / size) } }, msg: 'success' };
}

function handleTransferWallet(path, body, user) {
  if (!user) return { code: 401, data: null, msg: 'Unauthorized' };
  const { fromSymbol, toSymbol, amount } = body;
  if (!fromSymbol || !toSymbol || amount <= 0) return { code: 400, data: null, msg: 'Invalid params' };
  const from = queryOne("SELECT * FROM wallets WHERE user_id = ? AND coin_symbol = ?", [user.id, fromSymbol]);
  if (!from || from.available < amount) return { code: 400, data: null, msg: 'Insufficient balance' };
  const to = queryOne("SELECT * FROM wallets WHERE user_id = ? AND coin_symbol = ?", [user.id, toSymbol]);
  if (!to) return { code: 400, data: null, msg: 'Target wallet not found' };
  const db = getDbSync();
  db.run("UPDATE wallets SET available = available - ? WHERE user_id = ? AND coin_symbol = ?", [amount, user.id, fromSymbol]);
  db.run("UPDATE wallets SET available = available + ? WHERE user_id = ? AND coin_symbol = ?", [amount, user.id, toSymbol]);
  db.run("INSERT INTO flow_records (user_id, type, coin_symbol, amount, balance, remark) VALUES (?, ?, ?, ?, ?, ?)",
    [user.id, 'transfer', fromSymbol, -amount, from.available - amount, `Transfer to ${toSymbol}`]);
  saveDb();
  return { code: 200, data: null, msg: 'success' };
}

function handleConvertSymbol(path, body, user) {
  if (!user) return { code: 401, data: null, msg: 'Unauthorized' };
  const { fromSymbol, toSymbol, amount } = body;
  if (!fromSymbol || !toSymbol || amount <= 0) return { code: 400, data: null, msg: 'Invalid params' };
  const from = queryOne("SELECT * FROM wallets WHERE user_id = ? AND coin_symbol = ?", [user.id, fromSymbol]);
  if (!from || from.available < amount) return { code: 400, data: null, msg: 'Insufficient balance' };
  const db = getDbSync();
  db.run("UPDATE wallets SET available = available - ? WHERE user_id = ? AND coin_symbol = ?", [amount, user.id, fromSymbol]);
  db.run("UPDATE wallets SET available = available + ? WHERE user_id = ? AND coin_symbol = ?", [amount, user.id, toSymbol]);
  saveDb();
  return { code: 200, data: { fromAmount: amount, toAmount: amount, rate: 1 }, msg: 'success' };
}

// ========== 交易 ==========

function handleCoinBuy(path, body, user) {
  if (!user) return { code: 401, data: null, msg: 'Unauthorized' };
  const { symbol, type, price, amount, total } = body;
  if (!symbol || !amount || amount <= 0) return { code: 400, data: null, msg: 'Invalid params' };
  const baseCoin = symbol.replace(/USDT$/, '');
  const side = type === 'sell' ? 'sell' : 'buy';
  const orderPrice = price || 0;
  const orderTotal = total || (orderPrice * amount);
  const fee = orderTotal * config.FEE_RATE;
  const orderNo = uuidv4().replace(/-/g, '').substring(0, 20).toUpperCase();
  const db = getDbSync();

  if (side === 'buy') {
    const usdt = queryOne("SELECT * FROM wallets WHERE user_id = ? AND coin_symbol = ?", [user.id, 'USDT']);
    if (!usdt || usdt.available < orderTotal + fee) return { code: 400, data: null, msg: 'Insufficient USDT' };
    db.run("UPDATE wallets SET available = available - ? - ? WHERE user_id = ? AND coin_symbol = ?", [orderTotal, fee, user.id, 'USDT']);
    let cw = queryOne("SELECT * FROM wallets WHERE user_id = ? AND coin_symbol = ?", [user.id, baseCoin]);
    if (!cw) {
      db.run("INSERT INTO wallets (user_id, coin_symbol, coin_name, available, frozen, icon, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [user.id, baseCoin, baseCoin, 0, 0, '', 10]);
      cw = queryOne("SELECT * FROM wallets WHERE user_id = ? AND coin_symbol = ?", [user.id, baseCoin]);
    }
    db.run("UPDATE wallets SET available = available + ? WHERE user_id = ? AND coin_symbol = ?", [amount, user.id, baseCoin]);
  } else {
    const cw = queryOne("SELECT * FROM wallets WHERE user_id = ? AND coin_symbol = ?", [user.id, baseCoin]);
    if (!cw || cw.available < amount) return { code: 400, data: null, msg: `Insufficient ${baseCoin}` };
    db.run("UPDATE wallets SET available = available - ? WHERE user_id = ? AND coin_symbol = ?", [amount, user.id, baseCoin]);
    db.run("UPDATE wallets SET available = available + ? - ? WHERE user_id = ? AND coin_symbol = ?", [orderTotal, fee, user.id, 'USDT']);
  }

  db.run("INSERT INTO orders (user_id, order_no, order_type, side, symbol, price, amount, total, fee, status) VALUES (?, ?, 'spot', ?, ?, ?, ?, ?, ?, 'filled')",
    [user.id, orderNo, side, symbol, orderPrice, amount, orderTotal, fee]);
  db.run("INSERT INTO flow_records (user_id, type, coin_symbol, amount, remark, order_no) VALUES (?, ?, ?, ?, ?, ?)",
    [user.id, side === 'buy' ? 'buy' : 'sell', side === 'buy' ? 'USDT' : baseCoin,
     side === 'buy' ? -(orderTotal + fee) : -amount, `${side} ${amount} ${baseCoin}`, orderNo]);
  saveDb();

  return { code: 200, data: { orderNo, symbol, side, price: orderPrice, amount, total: orderTotal, fee, status: 'filled' }, msg: 'success' };
}

function handleFuturesBuy(path, body, user) {
  if (!user) return { code: 401, data: null, msg: 'Unauthorized' };
  const { symbol, side, leverage, price, amount, margin } = body;
  if (!symbol || !amount || !margin) return { code: 400, data: null, msg: 'Invalid params' };
  const usdt = queryOne("SELECT * FROM wallets WHERE user_id = ? AND coin_symbol = ?", [user.id, 'USDT']);
  if (!usdt || usdt.available < margin) return { code: 400, data: null, msg: 'Insufficient margin' };
  // 开仓价：优先用请求中的 price，否则取实时行情缓存
  let openPrice = price || 0;
  if (openPrice === 0) {
    const cache = global.__priceCache || {};
    const s = (symbol || '').toUpperCase();
    if (cache[s] && cache[s].price) {
      openPrice = parseFloat(cache[s].price);
    }
  }
  const fee = margin * config.FEE_RATE_FUTURES;
  const orderNo = uuidv4().replace(/-/g, '').substring(0, 20).toUpperCase();
  const db = getDbSync();
  db.run("UPDATE wallets SET available = available - ? WHERE user_id = ? AND coin_symbol = ?", [margin, user.id, 'USDT']);
  const stmt = db.prepare("INSERT INTO positions (user_id, symbol, side, leverage, open_price, amount, margin, fee, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open')");
  stmt.run([user.id, symbol, side || 'long', leverage || 1, openPrice, amount, margin, fee]);
  const positionId = queryOne('SELECT last_insert_rowid() as id').id;
  saveDb();
  return { code: 200, data: { orderNo, positionId, symbol, side: side || 'long', openPrice, margin, fee }, msg: 'success' };
}

function handleFuturesClose(path, body, user) {
  if (!user) return { code: 401, data: null, msg: 'Unauthorized' };
  try {
  const { id } = body;
  if (!id) return { code: 400, data: null, msg: 'Missing position id' };
  const pos = queryOne("SELECT * FROM positions WHERE user_id = ? AND id = ? AND status = 'open'", [user.id, id]);
  if (!pos) return { code: 400, data: null, msg: 'Position not found, id: ' + id };

  // 获取当前市场价
  const cache = global.__priceCache || {};
  let closePrice = pos.open_price; // 默认用开仓价（无盈亏）
  if (cache[pos.symbol] && cache[pos.symbol].price) {
    closePrice = parseFloat(cache[pos.symbol].price);
  }
  // 计算真实 PnL
  const isLong = pos.side === 'long';
  const priceDiff = isLong ? (closePrice - pos.open_price) : (pos.open_price - closePrice);
  const pnl = priceDiff * pos.amount * (pos.leverage || 1) - (pos.fee || 0);
  const ret = pos.margin + pnl;

  const db = getDbSync();
  db.run("UPDATE positions SET status = 'closed', closed_at = datetime('now'), close_price = ?, pnl = ? WHERE id = ?",
    [closePrice, pnl, id]);
  db.run("UPDATE wallets SET available = available + ? WHERE user_id = ? AND coin_symbol = ?", [Math.max(ret, 0), user.id, 'USDT']);
  // 记录流水
  db.run("INSERT INTO flow_records (user_id, type, coin_symbol, amount, balance, remark) VALUES (?, ?, ?, ?, ?, ?)",
    [user.id, 'futures_close', 'USDT', pnl, 0, `Close ${pos.symbol} ${pos.side} PnL:${pnl.toFixed(2)}`]);
  saveDb();
  return { code: 200, data: { positionId: id, openPrice: pos.open_price, closePrice: closePrice.toFixed(8), pnl: pnl.toFixed(2), returnAmount: Math.max(ret, 0).toFixed(2) }, msg: 'success' };
  } catch(e) {
    console.error('[ERROR] handleFuturesClose error:', e.message, e.stack);
    return { code: 500, data: null, msg: 'Internal error: ' + (e.message || e) };
  }
}

// ========== 订单 ==========

function handleTransactionCurrency(path, body, user) {
  if (!user) return { code: 200, data: { content: { records: [], total: 0, size: 10, current: 1, pages: 0 } } };
  const { page = 1, size = 10, symbol, status, type } = body;
  let where = "WHERE user_id = ? AND order_type = 'spot'", params = [user.id];
  if (symbol) { where += " AND symbol = ?"; params.push(symbol); }
  if (status) { where += " AND status = ?"; params.push(status); }
  if (type) { where += " AND side = ?"; params.push(type); }
  const records = queryAll(`SELECT * FROM orders ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, size, (page - 1) * size]);
  const cnt = getDbSync().exec(`SELECT COUNT(*) FROM orders ${where}`, params);
  const total = cnt[0]?.values[0]?.[0] || 0;
  return { code: 200, data: { content: { records, total, size, current: page, pages: Math.ceil(total / size) } }, msg: 'success' };
}

function handlePositionDetail(path, body, user) {
  if (!user) return { code: 200, data: [] };
  const orders = queryAll("SELECT * FROM orders WHERE user_id = ? AND order_type = 'spot' AND status = 'filled'", [user.id]);
  return { code: 200, data: orders.map(o => ({ symbol: o.symbol, side: o.side, amount: o.amount, price: o.price })), msg: 'success' };
}

function handleContractRecords(path, body, user) {
  if (!user) return { code: 200, data: { content: { records: [], total: 0, size: 10, current: 1, pages: 0 } } };
  const { page = 1, size = 10, symbol, status } = body;
  let where = "WHERE user_id = ?", params = [user.id];
  if (symbol) { where += " AND symbol = ?"; params.push(symbol); }
  if (status) { where += " AND status = ?"; params.push(status); }
  const records = queryAll(`SELECT * FROM positions ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, size, (page - 1) * size]);
  const cnt = getDbSync().exec(`SELECT COUNT(*) FROM positions ${where}`, params);
  const total = cnt[0]?.values[0]?.[0] || 0;
  return { code: 200, data: { content: { records, total, size, current: page, pages: Math.ceil(total / size) } }, msg: 'success' };
}

// ========== 用户间转账 ==========

function handleTransferUser(path, body, user) {
  if (!user) return { code: 401, data: null, msg: 'Unauthorized' };
  const { toUserId, coinSymbol, amount, transactionPsw } = body;
  if (!toUserId || !coinSymbol || !amount || amount <= 0) return { code: 400, data: null, msg: 'Invalid params' };
  // 验证资金密码
  if (user.transaction_psw) {
    const valid = bcrypt.compareSync(transactionPsw || '', user.transaction_psw);
    if (!valid) return { code: 400, data: null, msg: 'Incorrect transaction password' };
  }
  // 查询目标用户
  const targetUser = queryOne("SELECT id, username FROM users WHERE id = ?", [toUserId]);
  if (!targetUser) return { code: 400, data: null, msg: 'Target user not found' };
  if (targetUser.id === user.id) return { code: 400, data: null, msg: 'Cannot transfer to yourself' };
  // 查询转出钱包
  const fromWallet = queryOne("SELECT * FROM wallets WHERE user_id = ? AND coin_symbol = ?", [user.id, coinSymbol]);
  if (!fromWallet || fromWallet.available < amount) return { code: 400, data: null, msg: 'Insufficient balance' };
  // 查询或创建目标用户钱包
  let toWallet = queryOne("SELECT * FROM wallets WHERE user_id = ? AND coin_symbol = ?", [targetUser.id, coinSymbol]);
  const db = getDbSync();
  if (!toWallet) {
    db.run("INSERT INTO wallets (user_id, coin_symbol, coin_name, available, frozen, icon, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [targetUser.id, coinSymbol, coinSymbol, 0, 0, '', 10]);
    toWallet = queryOne("SELECT * FROM wallets WHERE user_id = ? AND coin_symbol = ?", [targetUser.id, coinSymbol]);
  }
  // 执行转账
  const fee = amount * config.FEE_RATE;
  db.run("UPDATE wallets SET available = available - ? WHERE user_id = ? AND coin_symbol = ?", [amount, user.id, coinSymbol]);
  db.run("UPDATE wallets SET available = available + ? WHERE user_id = ? AND coin_symbol = ?", [amount - fee, targetUser.id, coinSymbol]);
  // 记录流水
  const remark = `Transfer to user ${targetUser.username || targetUser.id}`;
  db.run("INSERT INTO flow_records (user_id, type, coin_symbol, amount, balance, remark) VALUES (?, ?, ?, ?, ?, ?)",
    [user.id, 'transfer_out', coinSymbol, -amount, fromWallet.available - amount, remark]);
  db.run("INSERT INTO flow_records (user_id, type, coin_symbol, amount, balance, remark) VALUES (?, ?, ?, ?, ?, ?)",
    [targetUser.id, 'transfer_in', coinSymbol, amount - fee, (toWallet?.available || 0) + amount - fee, `Transfer from user ${user.username || user.id}`]);
  saveDb();
  return { code: 200, data: { toUserId: targetUser.id, coinSymbol, amount, fee: fee.toFixed(8) }, msg: 'success' };
}

// ========== 平台配置 ==========

function handleGetIsDisplay(path, body) {
  // 原站直接返回平铺配置对象（不包装为 {code,data,msg}）
  // axios 拦截器 res.json(e.data) 会直接把这个对象传给前端
  // getGlobalConfig 中用 a["homeTheme"]、a["frontDeskShow"] 等直接访问
  return getIsDisplayConfig;
}

function handleGetValue(path, body) {
  const { key } = body || {};
  if (key && getIsDisplayConfig[key] !== undefined) {
    return { code: 'SUCCESS', message: 'process success', data: getIsDisplayConfig[key], value: getIsDisplayConfig[key] };
  }
  return { code: 'SUCCESS', message: 'process success', data: null, value: null };
}

function handleCoinList(path, body) {
  // 基础币种信息（前端首页和交易页需要）
  const baseCoins = [
    { symbol: 'BTCUSDT', coinName: 'Bitcoin', icon: '' },
    { symbol: 'ETHUSDT', coinName: 'Ethereum', icon: '' },
    { symbol: 'BNBUSDT', coinName: 'BNB', icon: '' },
    { symbol: 'SOLUSDT', coinName: 'Solana', icon: '' },
    { symbol: 'XRPUSDT', coinName: 'XRP', icon: '' },
  ];
  const cache = global.__priceCache || {};
  const coins = baseCoins.map(b => {
    const c = cache[b.symbol];
    if (c && c.price) {
      return {
        symbol: b.symbol,
        coinName: b.coinName,
        icon: b.icon,
        price: parseFloat(c.price).toFixed(8),
        change: (c.change_percent || 0).toFixed(2),
        volume: String(Math.round(c.volume_24h || 0)),
        high: '',
        low: '',
      };
    }
    // 缓存未就绪时回退硬编码
    const fallback = { 'BTCUSDT':'79778.00000000','ETHUSDT':'2277.41000000','BNBUSDT':'638.65000000','SOLUSDT':'88.35000000','XRPUSDT':'1.38600000' };
    return {
      ...b,
      price: fallback[b.symbol] || '0.00000000',
      change: '0.00',
      volume: '0',
      high: '',
      low: '',
    };
  });
  return { code: 200, content: coins, msg: 'success' };
}

function handleGetPrice(path, body) {
  const { symbol } = body || {};
  if (!symbol) return { code: 'ERROR', message: 'symbol required', data: null };
  const s = symbol.toUpperCase();
  // 优先使用实时缓存
  const cache = global.__priceCache || {};
  if (cache[s] && cache[s].price) {
    return { symbol: s, price: parseFloat(cache[s].price).toFixed(8) };
  }
  // 缓存未就绪时回退硬编码
  const prices = {
    'BTCUSDT': '79778.00000000',
    'ETHUSDT': '2277.41000000',
    'BNBUSDT': '638.65000000',
    'SOLUSDT': '88.35000000',
    'XRPUSDT': '1.38600000',
    'DOGEUSDT': '0.15230000',
    'ADAUSDT': '0.38450000',
    'AVAXUSDT': '22.87000000',
    'DOTUSDT': '5.42000000',
    'LINKUSDT': '12.35000000',
    'MATICUSDT': '0.58200000',
    'SHIBUSDT': '0.00001452',
    'LTCUSDT': '72.45000000',
    'TRXUSDT': '0.09120000',
    'UNIUSDT': '6.23000000',
    'ATOMUSDT': '7.15000000',
    'ETCUSDT': '18.67000000',
    'FILUSDT': '4.28000000',
    'APTUSDT': '7.85000000',
    'ARBUSDT': '0.83200000',
    'OPUSDT': '1.45000000',
    'NEARUSDT': '4.12000000',
    'SUIUSDT': '0.67500000',
    'PEPEUSDT': '0.00000823',
    'FLOKIUSDT': '0.00012800',
    'WIFUSDT': '1.23000000',
    'AAVEUSDT': '82.40000000',
    'MKRUSDT': '1350.00000000',
  };
  const price = prices[s];
  if (!price) return { code: 'ERROR', message: 'Symbol not found', data: null };
  return { symbol: s, price };
}

function handleMyState(path, body, user) {
  if (!user) return { code: 'NOT_LOGIN', message: '请先登录或注册', data: null };
  return { code: 200, data: { userId: user.id }, message: 'success' };
}

// ========== 工具 ==========

function formatUser(user, token) {
  return {
    id: String(user.id), userId: String(user.id),
    username: user.username || user.wallet_address || '',
    nickName: user.nick_name || '', avatar: user.avatar || '',
    email: user.email || '', phone: user.phone || '',
    walletAddress: user.wallet_address || '',
    inviteCode: user.invite_code || '',
    googleStatus: user.google_status || 0, status: user.status || 1,
    darkMode: user.dark_mode || 0, createTime: user.created_at,
    ...(token ? { token } : {})
  };
}

function generateCode() { return uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase(); }

function createDefaultWallets(userId) {
  const db = getDbSync();
  const coins = [
    { s: 'USDT', n: 'Tether', i: 'icon-usdt', o: 1 },
    { s: 'BTC', n: 'Bitcoin', i: 'icon-btc', o: 2 },
    { s: 'ETH', n: 'Ethereum', i: 'icon-eth', o: 3 },
    { s: 'BNB', n: 'BNB', i: 'icon-bnb', o: 4 },
    { s: 'SOL', n: 'Solana', i: 'icon-sol', o: 5 },
    { s: 'XRP', n: 'XRP', i: 'icon-xrp', o: 6 },
  ];
  for (const c of coins) {
    try { db.run("INSERT INTO wallets (user_id, coin_symbol, coin_name, available, frozen, icon, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [userId, c.s, c.n, c.s === 'USDT' ? 10000 : 0, 0, c.i, c.o]); } catch(e) {}
  }
  try { db.run("INSERT INTO flow_records (user_id, type, coin_symbol, amount, balance, remark) VALUES (?, ?, ?, ?, ?, ?)",
    [userId, 'bonus', 'USDT', 10000, 10000, 'New user bonus']); } catch(e) {}
  saveDb();
}

// ========== RockieMessage / rockieFile ==========

function handleRockieMessageGetValue(path, body) {
  // 前端 getGlobalConfig 和 getWebInfo 初始化依赖此 API
  // 必须返回完整数据，否则 Vue 卡在 Loading
  return {
    code: 200,
    data: {
      fileId: '9007393',
      url: '',
      msg: 'success',
      name: 'Klakna',
      address: 'Klakna Exchange',
      phone: '',
      advertising: '9007393',
      email: 'kiarlavip@gmail.com',
      parameter: '9007394',
      parameter1: '9007395',
      parameter2: '1',
      parameter3: '2525',
      video: '9003227',
      explain: '',
      homeTheme: '',
      miningCode: '',
      miningUrl: '',
      service_config: '{}',
      tabBarConfig: '{}',
      stockCountryId: 5,
      // 🔧 getGlobalConfig 额外需要的字段（缺失会导致 JSON.parse(undefined) 崩溃）
      frontDeskShow: '{"goldAi":0,"loAn":0}',
      sumpay: 0,
      subscription: '',
      subscriptionSwitch: '',
      generalInvite: 0,
      isShowICO: 0,
      isShowIPO: 0,
      FasTransactions: 1,
      contract_multiple: '{}',
      tradeSort: '',
      account: '{}',
      cryptoUSDT: 'USDT',
      isShowAuthentication: 1,
      isShowRank: 0,
      experienceAmount: 0,
      serviceScript: null,
      ReviseUserName: '',
      memorizationUserName: '',
      PendingReview: '0',
      AIStatistics: '{}',
      walletAccountList: '{}',
      BankCardCash: '{}',
      earnConfig: '{}',
      handToAmount: '{}',
    },
    msg: 'success'
  };
}

function handleRockieMessageGetApp(path, query) {
  return {
    code: 200,
    data: {
      androidUrl: '',
      iosUrl: '',
      version: '',
      updateContent: '',
    },
    msg: 'success'
  };
}

function handleRockieFileGetFile(path, query) {
  // 根据 fileId 返回文件 URL（前端 <img src=...）
  const fileId = query?.fileId || 'default-avatar.png';
  return {
    code: 200,
    data: {
      url: '/static/files/' + fileId,
      fileId: fileId
    },
    msg: 'success'
  };
}

// ========== 充值/提现 ==========

function handleRechargeApply(path, body, user) {
  if (!user) return { code: 401, data: null, msg: 'Unauthorized' };
  const { coinSymbol = 'USDT', amount, network, address, txHash, proofImage } = body;
  if (!amount || amount <= 0) return { code: 400, data: null, msg: 'Amount required' };
  const db = getDbSync();
  db.run(`INSERT INTO recharge_records (user_id, coin_symbol, amount, network, address, tx_hash, proof_image, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [user.id, coinSymbol, amount, network || '', address || '', txHash || '', proofImage || '']);
  saveDb();
  return { code: 200, data: null, msg: 'Recharge application submitted' };
}

function handleRechargeList(path, body, user) {
  if (!user) return { code: 200, data: { content: { records: [], total: 0, size: 10, current: 1, pages: 0 } } };
  const { page = 1, size = 10 } = body;
  const records = queryAll(`SELECT * FROM recharge_records WHERE user_id = ? ORDER BY id DESC LIMIT ? OFFSET ?`,
    [user.id, size, (page - 1) * size]);
  const cnt = getDbSync().exec(`SELECT COUNT(*) FROM recharge_records WHERE user_id = ?`, [user.id]);
  const total = cnt[0]?.values[0]?.[0] || 0;
  return { code: 200, data: { content: { records, total, size, current: page, pages: Math.ceil(total / size) } }, msg: 'success' };
}

function handleWithdrawApply(path, body, user) {
  if (!user) return { code: 401, data: null, msg: 'Unauthorized' };
  const { coinSymbol = 'USDT', amount, fee = 0, address } = body;
  if (!amount || amount <= 0) return { code: 400, data: null, msg: 'Amount required' };
  if (!address) return { code: 400, data: null, msg: 'Address required' };
  const totalAmount = amount + fee;
  const w = queryOne("SELECT * FROM wallets WHERE user_id = ? AND coin_symbol = ?", [user.id, coinSymbol]);
  if (!w || w.available < totalAmount) return { code: 400, data: null, msg: 'Insufficient balance' };
  const db = getDbSync();
  db.run("UPDATE wallets SET available = available - ?, frozen = frozen + ? WHERE user_id = ? AND coin_symbol = ?",
    [totalAmount, totalAmount, user.id, coinSymbol]);
  db.run(`INSERT INTO withdraw_records (user_id, coin_symbol, amount, fee, address, status)
          VALUES (?, ?, ?, ?, ?, 'pending')`,
    [user.id, coinSymbol, amount, fee, address]);
  db.run("INSERT INTO flow_records (user_id, type, coin_symbol, amount, balance, remark) VALUES (?, ?, ?, ?, ?, ?)",
    [user.id, 'withdraw_freeze', coinSymbol, -totalAmount, w.available - totalAmount, `Withdraw freeze: ${amount} + fee ${fee}`]);
  saveDb();
  return { code: 200, data: null, msg: 'Withdrawal application submitted' };
}

function handleWithdrawList(path, body, user) {
  if (!user) return { code: 200, data: { content: { records: [], total: 0, size: 10, current: 1, pages: 0 } } };
  const { page = 1, size = 10 } = body;
  const records = queryAll(`SELECT * FROM withdraw_records WHERE user_id = ? ORDER BY id DESC LIMIT ? OFFSET ?`,
    [user.id, size, (page - 1) * size]);
  const cnt = getDbSync().exec(`SELECT COUNT(*) FROM withdraw_records WHERE user_id = ?`, [user.id]);
  const total = cnt[0]?.values[0]?.[0] || 0;
  return { code: 200, data: { content: { records, total, size, current: page, pages: Math.ceil(total / size) } }, msg: 'success' };
}

// Stats - 返回空数据避免 404
function handleStats(path, body) {
  return {
    code: 200,
    data: {
      visitors: 0,
      pageViews: 0,
      uptime: process.uptime(),
    },
    msg: 'success'
  };
}

// getFile - 返回空数据避免 404
function handleGetFile(path, body) {
  return { code: 200, data: { url: '', name: '' }, msg: 'success' };
}

module.exports = { match };
