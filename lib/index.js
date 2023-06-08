"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const amqplib_1 = __importDefault(require("amqplib"));
const events_1 = __importDefault(require("events"));
const uuid_1 = require("uuid");
const helpers_1 = require("./helpers");
class AmqpManager {
    constructor() {
        this.listConsumes = new Map;
    }
    init(amqpConfig, onCloseCallback, onErrorCallback) {
        return __awaiter(this, void 0, void 0, function* () {
            this.amqpConfig = amqpConfig;
            this.onCloseCallback = onCloseCallback;
            this.onErrorCallback = onErrorCallback;
            yield this.initConnect(amqpConfig);
        });
    }
    initConnect(amqpConfig, waitToTry) {
        return __awaiter(this, void 0, void 0, function* () {
            waitToTry && (yield (0, helpers_1.wait)(5000).promise);
            amqpConfig.debugLogs && console.log(`try to connect ${amqpConfig.url}`);
            const opt = {
                credentials: (amqpConfig.user && amqpConfig.password)
                    && amqplib_1.default.credentials.plain(amqpConfig.user, amqpConfig.password),
                timeout: amqpConfig.timeout
            };
            try {
                this.connect = yield amqplib_1.default.connect(amqpConfig.url, opt);
                this.onClose();
                this.onError();
                amqpConfig.debugLogs && console.log(`connected to ${amqpConfig.url}`);
                yield this.restoreConsumes();
            }
            catch (e) {
                amqpConfig.debugLogs && console.error(`Error connect to ${amqpConfig.url}, ${e.message}`);
                this.onErrorCallback && this.onErrorCallback('RabbitMQ connection error');
                this.initConnect(amqpConfig, true);
            }
        });
    }
    restoreConsumes() {
        return __awaiter(this, void 0, void 0, function* () {
            for (const key of this.listConsumes.keys()) {
                const consumer = this.listConsumes.get(key);
                consumer && (yield this.addConsume(consumer, true));
            }
        });
    }
    onError() {
        if (this.connect != null) {
            this.connect.on('error', () => __awaiter(this, void 0, void 0, function* () {
                this.connect = null;
                this.onErrorCallback && this.onErrorCallback('RabbitMQ connection error');
                yield this.initConnect(this.amqpConfig, true);
            }));
        }
        else {
            throw new Error('Connecting is close');
        }
    }
    onClose() {
        if (this.connect != null) {
            this.connect.on('close', () => __awaiter(this, void 0, void 0, function* () {
                this.connect = null;
                this.onCloseCallback && this.onCloseCallback('Close RabbitMQ connection');
                yield this.initConnect(this.amqpConfig, true);
            }));
        }
        else {
            throw new Error('Close connection');
        }
    }
    queueSubscribe(channel) {
        return __awaiter(this, void 0, void 0, function* () {
            const q = yield channel.assertQueue('', { exclusive: true });
            channel.responseEmitter = new events_1.default();
            channel.responseEmitter.setMaxListeners(0);
            channel.consume(q.queue, (msg) => channel.responseEmitter.emit(msg === null || msg === void 0 ? void 0 : msg.properties.correlationId, msg), { noAck: true });
            return q.queue;
        });
    }
    isConnected() {
        return this.connect != null;
    }
    sendRPCMessageWithResponse(rpcQueue, message, timerError = 5000, opt) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            const correlationId = (0, uuid_1.v4)();
            const channel = yield this.getChannel();
            if (channel == null)
                reject('channel not init');
            const replyTo = yield this.queueSubscribe(channel);
            const timer = setTimeout(() => {
                channel.removeAllListeners(correlationId);
                channel.close();
                reject('timeout');
            }, timerError);
            channel.responseEmitter.once(correlationId, (e) => {
                clearTimeout(timer);
                channel.close();
                resolve(e);
            });
            channel.sendToQueue(rpcQueue, Buffer.from(message), Object.assign({ correlationId, replyTo }, opt));
        }));
    }
    delConsume(rpcQueue) {
        var _a;
        const consumer = this.listConsumes.get(rpcQueue);
        if (consumer) {
            (_a = consumer.channel) === null || _a === void 0 ? void 0 : _a.close();
            this.listConsumes.delete(rpcQueue);
            return true;
        }
        else {
            return false;
        }
    }
    addConsume(consume, restore, opt) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.listConsumes.get(consume.rpcQueue) && !restore)
                throw new Error('rpcQueue already subscribed');
            const channel = yield this.getChannel();
            if (channel) {
                consume.channel = channel;
                yield channel.assertQueue(consume.rpcQueue, Object.assign({ durable: false }, opt));
                yield channel.consume(consume.rpcQueue, consume.onMessage, { noAck: true });
            }
            this.listConsumes.get(consume.rpcQueue) == null && this.listConsumes.set(consume.rpcQueue, consume);
        });
    }
    sendRPCMessage(rpcQueue, message, opt) {
        return __awaiter(this, void 0, void 0, function* () {
            const channel = yield this.getChannel();
            if (channel) {
                const isSend = channel.sendToQueue(rpcQueue, Buffer.from(message), opt);
                channel.close();
                return isSend;
            }
            else {
                return false;
            }
        });
    }
    getAmqpLibInstance() {
        return this.connect;
    }
    getChannel() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.connect != null)
                return yield this.connect.createChannel();
            else
                return null;
        });
    }
}
exports.default = AmqpManager;
