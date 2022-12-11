/// <reference types="node" />
import { Channel, Connection, ConsumeMessage, Options } from 'amqplib';
import EventEmitter from 'events';
export interface AmqpManagerConfig {
    debugLogs?: boolean;
    password?: string;
    timeout?: number;
    url: string;
    user?: string;
}
export interface ChannelWithResponse extends Channel {
    responseEmitter: EventEmitter;
}
interface Consume {
    channel?: Channel;
    rpcQueue: string;
    onMassage: (message: ConsumeMessage | null) => void;
}
declare class AmqpManager {
    private connect;
    private amqpConfig;
    private onCloseCallback;
    private onErrorCallback;
    private listConsumes;
    constructor();
    init(amqpConfig: AmqpManagerConfig, onCloseCallback?: Function, onErrorCallback?: Function): Promise<void>;
    private initConnect;
    private restoreConsumes;
    private onError;
    private onClose;
    private queueSubscribe;
    isConnected(): boolean;
    sendRPCMessageWithResponse(rpcQueue: string, message: any, timerError?: number, opt?: Options.Publish): Promise<ConsumeMessage>;
    delConsume(rpcQueue: string): boolean;
    addConsume(consume: Consume, restore: boolean): Promise<void>;
    sendRPCMessage(rpcQueue: string, message: any, opt?: Options.Publish): Promise<boolean>;
    getAmqpLibInstance(): Connection | null;
    private getChannel;
}
export default AmqpManager;
