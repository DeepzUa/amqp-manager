import amqplib, { Channel, Connection, ConsumeMessage, Options } from 'amqplib';
import EventEmitter from 'events';
import { v4 as uuidv4 } from 'uuid';
import { wait } from './helpers';

export interface AmqpManagerConfig  {
  debugLogs?: boolean,
  password?: string,
  timeout?: number,
  url: string,
  user?: string,
}

export interface ChannelWithResponse extends Channel {
  responseEmitter: EventEmitter
}

interface Consume {
  channel?: Channel,
  rpcQueue: string,
  onMassage: (message: ConsumeMessage | null) => void,
}

class AmqpManager {

  private connect!: Connection | null;
  private amqpConfig!: AmqpManagerConfig;
  private onCloseCallback!: Function | undefined;
  private onErrorCallback!: Function | undefined;
  private listConsumes: Map<string, Consume>;

  constructor() {
    this.listConsumes = new Map<string, Consume>;
  }

  async init(amqpConfig: AmqpManagerConfig, onCloseCallback?: Function, onErrorCallback?: Function) {
    this.amqpConfig = amqpConfig;
    this.onCloseCallback = onCloseCallback;
    this.onErrorCallback = onErrorCallback;
    await this.initConnect(amqpConfig);
  }

  private async initConnect(amqpConfig: AmqpManagerConfig, waitToTry?: boolean): Promise<void> {
    waitToTry && await wait(5000).promise;
    amqpConfig.debugLogs && console.log(`try to connect ${amqpConfig.url}`);
    const opt = {
      credentials: (amqpConfig.user && amqpConfig.password)
        && amqplib.credentials.plain(amqpConfig.user, amqpConfig.password),
      timeout: amqpConfig.timeout
    };
    try {
      this.connect = await amqplib.connect(amqpConfig.url, opt);
      this.onClose();
      this.onError();
      amqpConfig.debugLogs && console.log(`connected to ${amqpConfig.url}`);
      await this.restoreConsumes();
    } catch (e: any) {
      amqpConfig.debugLogs && console.error(`Error connect to ${amqpConfig.url}, ${e.message}`);
      this.onErrorCallback && this.onErrorCallback('RabbitMQ connection error');
      this.initConnect(amqpConfig, true);
    }
  }

  private async restoreConsumes(): Promise<void> {
    for (const key of this.listConsumes.keys()) {
      const consumer: Consume | undefined =  this.listConsumes.get(key);
      consumer && await this.addConsume(consumer, true);
    }
  }

  private onError(): void {
    if (this.connect != null){
      this.connect.on('error',  async () => {
        this.connect = null;
        this.onErrorCallback && this.onErrorCallback('RabbitMQ connection error');
        await this.initConnect(this.amqpConfig, true);
      });
    }else {
      throw new Error('Connecting is close');
    }
  }

  private onClose(): void {
    if (this.connect != null){
      this.connect.on('close',  async () => {
        this.connect = null;
        this.onCloseCallback && this.onCloseCallback('Close RabbitMQ connection');
        await this.initConnect(this.amqpConfig, true);
      });
    }else {
      throw new Error('Close connection');
    }
  }

  private async queueSubscribe(channel: ChannelWithResponse): Promise<string> {
    const q = await channel.assertQueue('', { exclusive: true });
    channel.responseEmitter = new EventEmitter();
    channel.responseEmitter.setMaxListeners(0);
    channel.consume(q.queue, (msg: ConsumeMessage | null) => channel.responseEmitter.emit(msg?.properties.correlationId, msg), { noAck: true });
    return q.queue;
  }

  public isConnected(): boolean {
    return this.connect != null;
  }

  sendRPCMessageWithResponse(rpcQueue: string, message: any, timerError = 5000, opt?: Options.Publish): Promise<ConsumeMessage> {
    return new Promise(async (resolve, reject) => {
      const correlationId = uuidv4();

      const channel: ChannelWithResponse = await this.getChannel() as ChannelWithResponse;

      if (channel == null)
        reject('channel not init');

      const replyTo = await this.queueSubscribe(channel);

      const timer = setTimeout(()=> {

        channel.removeAllListeners(correlationId);
        channel.close();
        reject('timeout');

      }, timerError);

      channel.responseEmitter.once(correlationId, (e)=>{
          clearTimeout(timer);
          channel.close();
          resolve(e);
      });

      channel.sendToQueue(rpcQueue, Buffer.from(message), { correlationId, replyTo, ...opt});
    });
  }


  delConsume(rpcQueue: string): boolean {
    const consumer: Consume | undefined = this.listConsumes.get(rpcQueue);
    if (consumer) {
      consumer.channel?.close();
      this.listConsumes.delete(rpcQueue);
      return true;
    }else {
      return false;
    }
  }

  async addConsume(consume: Consume, restore: boolean): Promise<void> {
    if (this.listConsumes.get(consume.rpcQueue) && !restore)
      throw new Error('rpcQueue already subscribed');

    const channel = await this.getChannel();
    if (channel) {
      consume.channel = channel;
      await channel.assertQueue(consume.rpcQueue, { durable: false });
      await channel.consume(consume.rpcQueue, consume.onMassage, { noAck: true })
    }
    this.listConsumes.get(consume.rpcQueue) == null && this.listConsumes.set(consume.rpcQueue, consume);
  }

  async sendRPCMessage(rpcQueue: string, message: any, opt?: Options.Publish): Promise<boolean> {
    const channel: Channel | null = await this.getChannel();
    if (channel) {
      const isSend = channel.sendToQueue(rpcQueue, Buffer.from(message), opt);
      channel.close();
      return isSend;
    }else {
      return false;
    }
  }

  private async getChannel(): Promise<Channel | null> {
    if (this.connect != null)
      return await this.connect.createChannel();
    else
      return null;
  }
}

export default AmqpManager
