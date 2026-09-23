/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

test('renders the Qleanfeel root component', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });

  expect(renderer!.root.findByProps({testID: 'qleanfeel-root'})).toBeTruthy();
  expect(renderer!.root.findByProps({children: 'Qleanfeel'})).toBeTruthy();
});
