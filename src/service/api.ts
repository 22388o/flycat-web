import axios from 'axios';
import { HexStr, Utf8Str } from 'types';
import { Buffer } from 'buffer';
import {
  bech32Decode,
  bech32Encode,
  generateRandomBytes,
  schnorrSign,
  Sha256,
} from './crypto';
const { version } = require('../../package.json');

export const DEFAULT_API_URL = 'http://accu.cc:8080';
export const DEFAULT_WS_API_URL = 'wss://nostr.v0l.io'; //"wss://nostr.v0l.io"//"wss://relay.nostr.bg";//'wss://nostr-relay.digitalmob.ro'//'wss://relay.damus.io'; //'wss://jiggytom.ddns.net';// "wss://demo.piesocket.com/v3/channel_123?api_key=VCXCEuvhGcBDP7XhiJJUDvR1e1D3eiVjgZ9VRiaV&notify_self"/

//axios.defaults.withCredentials = true;
export type ApiHttpResponse = {
  status: 'ok' | 'failed';
  data?: any;
  error?: string;
};
export enum HttpProtocolMethod {
  'get',
  'post',
  'option',
}
export type HttpRequest = (
  method: string,
  params?: Params,
  type?: HttpProtocolMethod,
) => Promise<any>;

export interface Params {
  [key: string]: any;
}

export class base {
  url: string;
  httpRequest: HttpRequest;

  constructor(baseUrl: string, httpRequest?: HttpRequest) {
    this.url = baseUrl;
    this.httpRequest = httpRequest || this.newHttpRequest();
  }

  newHttpRequest() {
    return async (
      method: string,
      _params: Params = {},
      type: HttpProtocolMethod = HttpProtocolMethod.get,
      cfg: {} = {},
    ) => {
      const baseUrl = this.url;
      const params = { ..._params, version };
      let axiosRes;
      const url = encodeURI(`${baseUrl}/${method}`);
      switch (type) {
        case HttpProtocolMethod.get:
          axiosRes = await axios.get(url, {
            params,
            ...cfg,
          });
          break;

        case HttpProtocolMethod.post:
          axiosRes = await axios.post(
            url,
            {
              data: params,
            },
            cfg,
          );
          break;

        default:
          throw new Error(`unsupported HttpRequestType, ${type}`);
      }
      if (axiosRes.status !== 200) {
        throw new Error(`http request fails, ${axiosRes}`);
      }

      const response = axiosRes.data;
      return response;
    };
  }

  async ping() {
    return await this.httpRequest('ping');
  }

  setUrl(newUrl: string) {
    if (newUrl.startsWith('http')) {
      this.url = newUrl;
    } else {
      this.url = `http://${newUrl}`;
    }
  }

  getUrl() {
    return this.url;
  }
}

export class Api extends base {
  constructor(url?: string, httpRequest?: HttpRequest) {
    const newHttpRequest = async (
      method: string,
      params: Object = {},
      type: HttpProtocolMethod = HttpProtocolMethod.get,
    ) => {
      const response: ApiHttpResponse = await super.newHttpRequest()(
        method,
        params,
        type,
      );
      return response;
    };
    super(url || DEFAULT_API_URL, httpRequest || newHttpRequest);
  }

  async getVersion(): Promise<string | null> {
    return await this.httpRequest('version', {}, HttpProtocolMethod.get);
  }
}

export type Hash64Bytes = string;
export type Hash32Bytes = string;
export type RelayUrl = string;
export type PetName = string;
export type SubscriptionId = HexStr;

export type EventId = Hash32Bytes;
export type PublicKey = Hash32Bytes;
export type PrivateKey = Hash32Bytes;
export type Signature = Hash64Bytes;
export type EventKind = number;
export enum WellKnownEventKind {
  set_metadata = 0,
  text_note,
  recommend_server,
  contact_list,
  flycat_site_metadata = 10000,
}
export enum EventTags {
  E = 'e',
  P = 'p',
}

export type EventETag = [EventTags.E, EventId, RelayUrl];
export type EventPTag = [EventTags.P, PublicKey, RelayUrl];
export type EventContactListPTag = [EventTags.P, PublicKey, RelayUrl, PetName];
export type EventResponse = ['EVENT', SubscriptionId, Event];
export type EventCLoseResponse = ['EOSE', SubscriptionId];

export interface Filter {
  ids?: EventId[];
  authors?: PublicKey[];
  kinds?: EventKind[];
  '#e'?: EventId[];
  '#p'?: PublicKey[];
  since?: number;
  until?: number;
  limit?: number;
}

export interface Event {
  id: EventId;
  pubkey: PublicKey;
  created_at: number; // unix timestamp in seconds,
  kind: EventKind;
  tags: (EventETag | EventPTag | EventContactListPTag | string[])[];
  content: string;
  sig: Signature;
}

export interface RawEvent {
  id?: EventId;
  pubkey: PublicKey;
  created_at: number; // unix timestamp in seconds,
  kind: EventKind;
  tags: (EventETag | EventPTag | EventContactListPTag)[];
  content: string;
}

export class RawEvent implements RawEvent {
  public id?: EventId;
  public pubkey: PublicKey;
  public created_at: number; // unix timestamp in seconds,
  public kind: EventKind;
  public tags: (EventETag | EventPTag | EventContactListPTag)[];
  public content: string;

  constructor(
    pubkey: PublicKey,
    kind: EventKind,
    tags?: (EventETag | EventPTag | EventContactListPTag)[],
    content?: string,
    created_at?: number,
  ) {
    this.pubkey = pubkey;
    this.kind = kind;
    this.tags = tags ?? [];
    this.content = content ?? '';
    this.created_at = created_at ?? Math.round(Date.now() / 1000);
  }

  sha256() {
    const data = this.serialize();
    return Sha256(data);
  }

  serialize() {
    const data = [
      0,
      this.pubkey.toLowerCase(), // <pubkey, as a (lowercase) hex string>,
      this.created_at, // <created_at, as a number>,
      this.kind, // <kind, as a number>,
      this.tags, // <tags, as an array of arrays of non-null strings>,
      this.content, // <content, as a string>
    ];
    return JSON.stringify(data);
  }

  async sign(privateKey: PrivateKey): Promise<Signature> {
    const hash = this.sha256();
    return await schnorrSign(hash, privateKey);
  }

  async toEvent(privateKey: PrivateKey): Promise<Event> {
    const sig = await this.sign(privateKey);
    const id = this.sha256();
    const event: Event = {
      id,
      pubkey: this.pubkey,
      kind: this.kind,
      content: this.content,
      created_at: this.created_at,
      tags: this.tags,
      sig,
    };
    return event;
  }
}

export interface EventSetMetadataContent {
  name: string; // username
  about: string; // user description,
  picture: string; // image url
}

export interface WsApiHandler {
  onMsgHandler?: (msg: any) => any;
  onOpenHandler?: (event: WsEvent) => any;
  onCloseHandler?: (event: WsEvent) => any;
  onErrHandler?: (event: WsEvent) => any;
}

export type WsEvent = globalThis.Event;

export class WsApi {
  private ws: WebSocket;

  constructor(url?: string, wsHandler?: WsApiHandler) {
    this.ws = new WebSocket(url || DEFAULT_WS_API_URL);

    this.ws.addEventListener('open', event => {
      if (wsHandler?.onOpenHandler) {
        wsHandler?.onOpenHandler(event);
      }
    });

    this.ws.onopen = wsHandler?.onOpenHandler || this.handleOpen;
    this.ws.onmessage = wsHandler?.onMsgHandler || this.handleMessage;
    this.ws.onerror = wsHandler?.onErrHandler || this.handleError;
    this.ws.onclose = wsHandler?.onCloseHandler || this.handleClose;
  }

  url() {
    return this.ws.url;
  }

  isConnected() {
    if (this.ws == null) return false;

    if (this.ws.readyState === WebSocket.OPEN) {
      return true;
    } else {
      return false;
    }
  }

  isClose() {
    if (this.ws == null) return false;

    if (this.ws.readyState === WebSocket.CLOSED) {
      return true;
    } else {
      return false;
    }
  }

  close() {
    this.ws.close();
  }

  async _send(data: string | ArrayBuffer) {
    if (this.isConnected()) {
      await this.ws.send(data);
    } else {
      console.log(
        `ws not open, abort send msg.., ws.readState: ${this.ws.readyState}`,
      );
    }
  }

  handleClose(event: any, callBack?: any) {
    console.log('ws close!', event);
    if (callBack) {
      callBack();
    }
  }

  handleOpen(event: any) {
    console.log('[handleOpen]ws connected!', event);
  }

  handleError(event: any) {
    console.error('error =>', event);
    if (this.ws) {
      this.ws.close();
    }
  }

  handleMessage(event: any, callback?: (msg: any) => any) {
    const msg: EventResponse | EventCLoseResponse = event.data;
    console.log('msg received =>', msg);
    if (callback != null) {
      callback(msg);
    }
  }

  handleEventResponse(event: any, callback?: (msg: Event) => any) {
    const msg: any = event.data;

    if (isEventResponse(msg)) {
      console.log('event: ', (msg as EventResponse)[2]);
    }

    if (callback != null) {
      callback((msg as EventResponse)[2]);
    }
  }

  async pubEvent(event: Event) {
    const pub = ['EVENT', event];
    return await this._send(JSON.stringify(pub));
  }

  async subFilter(filter: Filter) {
    const subId = randomSubId();
    const sub = ['REQ', subId, filter];
    return await this._send(JSON.stringify(sub));
  }

  async subUserMetadata(publicKeys: PublicKey[]) {
    const filter: Filter = {
      authors: publicKeys,
      kinds: [WellKnownEventKind.set_metadata],
      limit: publicKeys.length,
    };
    return await this.subFilter(filter);
  }

  async subUserContactList(publicKey: PublicKey) {
    const filter: Filter = {
      authors: [publicKey],
      kinds: [WellKnownEventKind.contact_list],
      limit: 1,
    };
    return await this.subFilter(filter);
  }

  async subUserRelayer(publicKey: PublicKey) {
    const filter: Filter = {
      authors: [publicKey],
      kinds: [WellKnownEventKind.recommend_server],
      limit: 1,
    };
    return await this.subFilter(filter);
  }

  async subUserSiteMetadata(publicKeys: PublicKey[]) {
    const filter: Filter = {
      authors: publicKeys,
      kinds: [WellKnownEventKind.flycat_site_metadata],
      limit: publicKeys.length,
    };
    return await this.subFilter(filter);
  }
}

export function isEventResponse(data: any): data is EventResponse {
  return (
    Array.isArray(data) &&
    data[0] === 'EVENT' &&
    typeof data[1] === 'string' &&
    isEvent(data[2])
  );
}

export function isEvent(data: any): data is Event {
  return (
    'id' in data &&
    'pubkey' in data &&
    'created_at' in data &&
    'kind' in data &&
    'tags' in data &&
    'content' in data &&
    'sig' in data
  );
}

export function isEventETag(data: any[]): data is EventETag {
  return (
    Array.isArray(data) &&
    data[0] === EventTags.E &&
    typeof data[1] === 'string' &&
    data[1].length === 64
  );
}

export function isEventPTag(data: any[]): data is EventPTag {
  return (
    Array.isArray(data) &&
    data[0] === EventTags.P &&
    typeof data[1] === 'string' &&
    data[1].length === 64
  );
}

export enum Nip19DataType {
  Pubkey = 'pubkey',
  Privkey = 'privkey',
  EventId = 'eventId',
}

export enum Nip19DataPrefix {
  Pubkey = 'npub',
  Privkey = 'nsec',
  EventId = 'note',
}

export function nip19Encode(data: string, type: Nip19DataType) {
  switch (type) {
    case Nip19DataType.Pubkey:
      return bech32Encode(data, Nip19DataPrefix.Pubkey);

    case Nip19DataType.Privkey:
      return bech32Encode(data, Nip19DataPrefix.Privkey);

    case Nip19DataType.EventId:
      return bech32Encode(data, Nip19DataPrefix.EventId);
    default:
      throw new Error(`unsupported type ${type}`);
  }
}

export function nip19Decode(data: string) {
  const { decoded, prefix } = bech32Decode(data);
  switch (prefix) {
    case Nip19DataPrefix.Pubkey:
      return { data: decoded, type: Nip19DataType.Pubkey };

    case Nip19DataPrefix.Privkey:
      return { data: decoded, type: Nip19DataType.Privkey };

    case Nip19DataPrefix.EventId:
      return { data: decoded, type: Nip19DataType.EventId };

    default:
      throw new Error(`unsupported prefix type ${prefix}`);
  }
}

export function randomSubId(size = 8): HexStr {
  return generateRandomBytes(size);
}

export function encodeMsg(userId: number, msg: Utf8Str): Buffer {
  const msgBytes = utf8StrToBuffer(msg);
  const msgSize = u32ToLEBuffer(msgBytes.length);
  const id = u32ToLEBuffer(userId);
  return Buffer.concat([id, msgSize, msgBytes]);
}

export function decodeMsg(msgInfo: Buffer) {
  const userIdBuf = msgInfo.slice(0, 4);
  const msgSizeBuf = msgInfo.slice(4, 8);
  const msgBuf = msgInfo.slice(8);

  const userIdNumber = LEBufferToU32(userIdBuf);
  const msg = bufferToUtf8Str(msgBuf);
  const msgSize = LEBufferToU32(msgSizeBuf);
  return {
    userId: userIdNumber,
    msgSize,
    msg,
  };
}

export function u32ToLEBuffer(u32: number): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(u32);
  return buf;
}

export function LEBufferToU32(buf: Buffer): number {
  const value = buf.readUInt32LE();
  return value;
}

export function utf8StrToBuffer(msg: Utf8Str): Buffer {
  const encoder = new TextEncoder();
  var uint8array = encoder.encode(msg);
  return Buffer.from(uint8array);
}

export function bufferToUtf8Str(buf: Buffer) {
  const decoder = new TextDecoder();
  const string = decoder.decode(buf);
  return string;
}
