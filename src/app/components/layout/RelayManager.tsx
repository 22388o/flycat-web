import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { connect } from 'react-redux';
import { RelayUrl } from 'service/api';
import { defaultRelays } from 'service/relay';
import { CallWorker } from 'service/worker/callWorker';
import { FromWorkerMessageData } from 'service/worker/type';
import { RelayStoreType } from 'store/relayReducer';
import RelayAdder from './RelayAdder';

export interface State {
  loginReducer: {
    isLoggedIn: boolean;
    publicKey: string;
    privateKey: string;
  };
  relayReducer: RelayStoreType;
}

const mapStateToProps = (state: State) => {
  return {
    isLoggedIn: state.loginReducer.isLoggedIn,
    myPublicKey: state.loginReducer.publicKey,
    myCustomRelay: state.relayReducer,
  };
};

export type WsConnectStatus = Map<RelayUrl, boolean>;

export const styles = {
  rightMenuLi: {
    padding: '0px',
  },
  simpleUl: {
    padding: '0px',
    margin: '20px 0px',
    listStyle: 'none' as const,
  },
  connected: {
    fontSize: '18px',
    fontWeight: '500',
    color: 'green',
  },
  disconnected: {
    fontSize: '18px',
    fontWeight: '500',
    color: 'red',
  },
};

export interface RelayManagerProps {
  isLoggedIn;
  myPublicKey;
  myCustomRelay: RelayStoreType;
}

export function RelayManager({
  isLoggedIn,
  myPublicKey,
  myCustomRelay,
}: RelayManagerProps) {
  const { t } = useTranslation();
  const [relays, setRelays] = useState<string[]>([]);
  const [wsConnectStatus, setWsConnectStatus] = useState<WsConnectStatus>(
    new Map(),
  );

  const [worker, setWorker] = useState<CallWorker>();
  let initCount = 0;
  let pubCount = 0;
  useEffect(() => {
    console.log('init worker', initCount++);
  }, []);
  useEffect(() => {
    const worker = new CallWorker((message: FromWorkerMessageData) => {
      if (message.wsConnectStatus) {
        const data = Array.from(message.wsConnectStatus.entries());
        for (const d of data) {
          setWsConnectStatus(prev => {
            const newMap = new Map(prev);
            newMap.set(d[0], d[1]);
            return newMap;
          });
        }
      }
    });
    setWorker(worker);
  }, []);

  useEffect(() => {
    // remove duplicated relay
    let relays = defaultRelays;
    if (isLoggedIn === true) {
      relays = relays
        .concat(...(myCustomRelay[myPublicKey] ?? []))
        .filter((item, index, self) => self.indexOf(item) === index);
    }

    setRelays(relays);
  }, [myPublicKey, myCustomRelay]);

  {
    useEffect(() => {
      if (relays.length === 0) return;
      if (worker == null) return;

      console.log('addrelay count:', pubCount++);
      worker?.addRelays(relays);
    }, [relays]);
  }
  // show relay status
  const relayerStatusUI: any[] = [];
  const relayerStatusIds: string[] = [];

  const connectStatusArray = Array.from(wsConnectStatus.entries());
  for (const url of relays) {
    let status = connectStatusArray.filter(c => c[0] === url).map(c => c[1])[0];
    if (status == null) {
      // not found, it is not connected
      status = false;
    }

    const style = status ? styles.connected : styles.disconnected;
    const item = (
      <li style={styles.rightMenuLi} key={url}>
        <span style={style}> · </span>
        <a href={url} target="_blank" rel="noreferrer">
          {url}
        </a>
      </li>
    );

    const index = relayerStatusIds.findIndex(v => v === url);
    if (index != -1) {
      relayerStatusUI[index] = item;
    } else {
      relayerStatusIds[relayerStatusIds.length] = url;
      relayerStatusUI[relayerStatusUI.length] = item;
    }
  }

  return (
    <div>
      <h3>
        {t('relayManager.title')}({relays.length})
      </h3>
      <ul style={styles.simpleUl}>{relayerStatusUI}</ul>
      <RelayAdder publicKey={myPublicKey} />
    </div>
  );
}

export default connect(mapStateToProps)(RelayManager);