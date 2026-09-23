# Qleanfeel

Qleanfeel is a React Native application for iOS and Android.

## Requirements

- Node.js 22.11 or newer
- Android Studio and an Android SDK for Android development
- Xcode and CocoaPods for iOS development

## Development

Install the locked JavaScript dependencies with `npm ci`, then start Metro:

```sh
npm start
```

Run the application on Android with `npm run android`. For iOS, install CocoaPods dependencies from `ios` before running `npm run ios`.

## Quality checks

```sh
npx tsc --noEmit
npm run lint
npm test
```
