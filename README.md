[![npm](https://img.shields.io/badge/npm-CB3837?style=for-the-badge&logo=npm&logoColor=white)](https://www.npmjs.com/package/amqp-rabbitmq-manager)
# Amqp-rabbitmq-manager

This library help to manage rabbitmq connections

### Features:
- Automatic reconnect to `Rabbitmq` server by default
- Restore `consumers` after reconnect to server
- Send message with response
#
##### Restore `consumers` after reconnect to server
```ts
import AmqpManager from 'amqp-rabbitmq-manager';

const amqpManager = new AmqpManager();
  await amqpManager.init({
    url: RABBITMQ_URL,
    user: RABBITMQ_USER,
    password: RABBITMQ_PASSWORD,
  },
  () => console.error('RabbitMQ connect close'),
  () => console.error('RabbitMQ connect error')
 );

 const restoreConsume = true;

 amqpManager.addConsume({
    rpcQueue: RABBITMQ_Q,
    onMessage: (message: string) => console.log(message)
 }, restoreConsume);
```
#
##### Send message with response
```ts
import AmqpManager from 'amqp-rabbitmq-manager';
import express, { Express, Request, Response } from 'express';

const amqpManager = new AmqpManager();
  await amqpManager.init({
    url: RABBITMQ_URL,
    user: RABBITMQ_USER,
    password: RABBITMQ_PASSWORD,
  },
  () => console.error('RabbitMQ connect close'),
  () => console.error('RabbitMQ connect error')
 );

const app: Express = express();

app.get('/sendwithresponse', async (req: Request, res: Response) => {
 const RABBITMQ_Q = 'ping';
 const timeOut = 2000;
 const message = JSON.stringify({hello: 'Hello'});
 try {
  const response = await amqpManager.sendRPCMessageWithResponse(RABBITMQ_Q, message, timeOut);
  res.send(response);
 } catch(e) {
  res.status(503).send('timeout');
 }

});

app.listen(3000,()=> console.log(`[SERVER]: services are started`) );
```
#
[![coffee](https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png)]("https://www.buymeacoffee.com/deepzua)

<a href="https://www.linkedin.com/in/pavlo-chmykh-2b48691a5/details/skills/" target="_blank"><img src="https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white" alt="Pavlo Chmykh"></a>
