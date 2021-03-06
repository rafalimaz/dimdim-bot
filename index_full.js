//index.js
"use strict";

require("dotenv-safe").load()
const MercadoBitcoin = require("./api").MercadoBitcoin
const MercadoBitcoinTrade = require("./api").MercadoBitcoinTrade
var infoApi = new MercadoBitcoin({ currency: 'BTC' })
var tradeApi = new MercadoBitcoinTrade({
    currency: 'BTC',
    key: process.env.KEY,
    secret: process.env.SECRET,
    pin: process.env.PIN
})

const UtilClass = require("./util").Util
var U = new UtilClass()

var d = {}
d.env = "test" // test | production
d.crawlerInteval = 20000
d.sellAmount = 0.001
d.buyAmount = 0.001
d.profit = 0.08
d.stopLoss = 0.015
d.takeProfit = 0.06
d.buyPrice = 30129
d.stopLossPrice = (d.lastPrice * (1 - parseFloat(d.stopLoss))).toFixed(2)
d.endExecution = false
d.checkSellOrder = false
d.confirmTrend = false;

function getQuantity(coin, price, isBuy, callback){
    price = parseFloat(price)
    coin = isBuy ? 'brl' : coin.toLowerCase()

    tradeApi.getAccountInfo((response_data) => {
        var balance = parseFloat(response_data.balance[coin].available).toFixed(5)
        balance = parseFloat(balance)
        if (isBuy && balance < 50) return console.log('Sem saldo disponível para comprar!')
        console.log(`Saldo disponível de ${coin}: ${balance}`)
        
        if (isBuy) balance = parseFloat((balance / price).toFixed(5))
        callback(parseFloat(balance) - 0.00001)//tira a diferença que se ganha no arredondamento
    }, 
    (data) => console.log(data))
}

function trade() {
    if (d.endExecution) {
        console.log("Execution finished.");
        console.log(new Date());
        process.exit(0)
    }

    if (d.checkSellOrder) 
    {
        //TODO checkNewPrice and verify if need cancel and recreate sell order
        console.log("Check if sell order is processed.");
        console.log(new Date());
        process.exit(0)
    }

    infoApi.ticker((tick) => {
        tick = tick.ticker
        var lastPrice = parseFloat(tick.last).toFixed(2);
        if (parseInt(lastPrice) == parseInt(d.currentPrice)) {
            logPrices(d, "No action necessary, same price: ", lastPrice);
            d.confirmTrend = false;
            return;
        }

        if (lastPrice < d.takeProfitPrice && lastPrice > d.stopLossPrice) {
            if (lastPrice > d.currentPrice) {
                resetStopLoss(d, lastPrice)
            }

            logPrices(d, "No action necessary: ", lastPrice);
            d.confirmTrend = false;
            return;
        } else if (lastPrice >= d.takeProfitPrice) {
            logPrices(d, "Take Profit: ", lastPrice);
        } else if (lastPrice <= d.stopLossPrice) {
            logPrices(d, "Stop Loss: ", lastPrice);
        } else {
            logPrices(d, "No action necessary: ", lastPrice);
            d.confirmTrend = false;
            return;
        }
        
        if (!d.confirmTrend) {
            console.log("Confirming trend...")
            d.confirmTrend = true;
            return;
        }
        
        console.log("Trend confirmed...")
        d.confirmTrend = false;
        if (d.env === "test") {
            console.log(`SIMULAÇÃO - Criada ordem de venda ${d.sellAmount} por ${lastPrice}`)
            d.tradeExecution++;
            d.checkSellOrder = true;
        }

        if (d.env === "production") {
            tradeApi.placeSellOrder(d.sellAmount, lastPrice,
                (data) => {
                    console.log(`Criada ordem de venda ${d.sellAmount} por ${lastPrice}`)
                    d.tradeExecution++;
                    d.checkSellOrder = true;
                },
                (data) => {
                    console.log('Erro ao inserir ordem de venda no livro. ' + data)
                }
            )
        }
    })
}

function resetStopLoss(d, lastPrice) {
    d.lastPrice = lastPrice
    d.currentPrice = lastPrice
    d.stopLossPrice = (d.lastPrice * (1 - d.stopLoss)).toFixed(2)
    logPrices(d, "Reset Stop Loss: ")
}

function resetPrices(d, lastPrice) {
    d.lastPrice = lastPrice
    d.currentPrice = lastPrice
    d.takeProfitPrice = (d.lastPrice * (1 + d.takeProfit)).toFixed(2)
    d.stopLossPrice = (d.lastPrice * (1 - d.stopLoss)).toFixed(2)
    logPrices(d, "Reset Prices: ")
}

function logPrices(d, msg, currentPrice) {
    let prices = {}
    
    if (currentPrice) {
        prices.currentPrice = currentPrice
    }

    prices.lastPrice = d.lastPrice
    prices.takeProfitPrice = d.takeProfitPrice
    prices.stopLossPrice = d.stopLossPrice
    
    console.log(msg);
    console.log(prices)
}

function easyStopLoss() {
    
}

function start() {
    d.tradeExecution = 0
    resetPrices(d, d.buyPrice)
    infoApi.ticker((tick) => {
        console.log("Start: " + new Date());
        //resetStopLoss(d, parseFloat(tick.ticker.last))
        setInterval(() => trade(), d.crawlerInteval)
    })
}

start();
