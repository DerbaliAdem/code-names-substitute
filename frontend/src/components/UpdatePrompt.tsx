// "A new version is out": shown once per app start on Android when GitHub has a newer release.
import React, { useEffect, useState } from 'react';
import { Linking, Modal, View } from 'react-native';
import { findUpdate, type Update } from '../update';
import { Body, Btn, Burst, Panel } from './ui';

export default function UpdatePrompt() {
  const [update, setUpdate] = useState<Update | null>(null);
  useEffect(() => { findUpdate().then(setUpdate, () => {}); }, []);
  if (!update) return null;
  const later = () => setUpdate(null);
  return (
    <Modal transparent animationType="fade" visible onRequestClose={later}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 }}>
        <View style={{ width: '100%', maxWidth: 420, alignSelf: 'center', gap: 16 }}>
          <Burst small title="NEW VERSION!" sub={`Version ${update.version} is out`} />
          <Panel>
            <Body>Download it, then open the file to install. Your name, hero and game stay as they are.</Body>
            <Btn label="Install now" onPress={() => { Linking.openURL(update.url).catch(() => {}); later(); }} />
            <Btn variant="alt" label="Later" onPress={later} />
          </Panel>
        </View>
      </View>
    </Modal>
  );
}
