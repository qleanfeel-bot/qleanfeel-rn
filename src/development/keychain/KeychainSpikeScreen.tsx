import React, { useCallback, useEffect, useState } from 'react';
import { Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Keychain from 'react-native-keychain';

const SERVICE = 'com.qleanfeel.development.m8-b0-keychain-spike';
const USERNAME = 'synthetic-spike-value';
const INITIAL_VALUE = 'm8-b0-spike-value-v1';
const REPLACEMENT_VALUE = 'm8-b0-spike-value-v2';

type Operation = 'write' | 'read' | 'replace' | 'delete' | 'inspect';

export function KeychainSpikeScreen(): React.JSX.Element {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('Check storage to begin.');

  const inspect = useCallback(async (operation: Operation = 'inspect') => {
    setBusy(true);
    try {
      if (operation === 'write') {
        await Keychain.setGenericPassword(USERNAME, INITIAL_VALUE, {
          service: SERVICE,
        });
      } else if (operation === 'replace') {
        await Keychain.setGenericPassword(USERNAME, REPLACEMENT_VALUE, {
          service: SERVICE,
        });
      } else if (operation === 'delete') {
        await Keychain.resetGenericPassword({ service: SERVICE });
        const afterDelete = await Keychain.getGenericPassword({
          service: SERVICE,
        });
        setResult(
          afterDelete === false
            ? 'Delete verified: no test value remains.'
            : 'Delete verification failed.',
        );
        return;
      }

      const stored = await Keychain.getGenericPassword({ service: SERVICE });
      if (stored === false) {
        setResult(
          operation === 'read'
            ? 'Read verified: no test value is stored.'
            : 'No test value found for this app install.',
        );
        return;
      }

      const matchesInitial =
        stored.username === USERNAME && stored.password === INITIAL_VALUE;
      const matchesReplacement =
        stored.username === USERNAME && stored.password === REPLACEMENT_VALUE;
      if (operation === 'write') {
        setResult(
          matchesInitial
            ? 'Write verified: synthetic value stored and read back.'
            : 'Write verification failed.',
        );
      } else if (operation === 'replace') {
        setResult(
          matchesReplacement
            ? 'Replace verified: replacement stored and read back.'
            : 'Replace verification failed.',
        );
      } else if (operation === 'read') {
        setResult(
          matchesInitial || matchesReplacement
            ? 'Read verified: stored synthetic value matches.'
            : 'Read verification failed.',
        );
      } else {
        setResult(
          matchesInitial || matchesReplacement
            ? 'Stored synthetic value found.'
            : 'Stored value did not match the spike values.',
        );
      }
    } catch {
      setResult(
        'Storage operation failed. No storage value was displayed or logged.',
      );
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    inspect();
  }, [inspect]);

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      testID="keychain-spike-screen"
    >
      <Text style={styles.title}>Development Keychain compatibility spike</Text>
      <Text style={styles.copy}>
        This screen uses only a fixed synthetic value under a dedicated
        development service name. It never displays or logs stored contents.
      </Text>
      <Text
        accessibilityLiveRegion="polite"
        style={styles.result}
        testID="keychain-spike-result"
      >
        {busy ? 'Checking secure storage…' : result}
      </Text>
      <View style={styles.actions}>
        <Button
          title="Write and verify"
          disabled={busy}
          onPress={() => inspect('write')}
          testID="keychain-write"
        />
        <Button
          title="Read and verify"
          disabled={busy}
          onPress={() => inspect('read')}
          testID="keychain-read"
        />
        <Button
          title="Replace and verify"
          disabled={busy}
          onPress={() => inspect('replace')}
          testID="keychain-replace"
        />
        <Button
          title="Delete and verify"
          disabled={busy}
          onPress={() => inspect('delete')}
          testID="keychain-delete"
        />
        <Button
          title="Check stored value"
          disabled={busy}
          onPress={() => inspect()}
          testID="keychain-inspect"
        />
      </View>
      <Text style={styles.note}>
        To check restart persistence: write the value, close and relaunch the
        debug app, then use “Check stored value”.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    gap: 16,
    padding: 20,
  },
  title: {
    color: '#17212b',
    fontSize: 20,
    fontWeight: '600',
  },
  copy: {
    color: '#334155',
    lineHeight: 22,
  },
  result: {
    color: '#17212b',
    minHeight: 44,
  },
  actions: {
    gap: 12,
  },
  note: {
    color: '#475569',
    lineHeight: 22,
  },
});
