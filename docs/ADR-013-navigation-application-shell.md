# ADR-013 — Cleaner Application Shell & Navigation

- **Status:** Accepted and implemented in M5
- **Date:** 2026-10-02

## Context

Before M5, the authenticated area did not have a full navigation shell. Profile, Calendar, and Orders were selected through local component state. M5 adds Home, Calendar day/details navigation, Orders create/details navigation, bottom navigation, and predictable nested back behavior while preserving the M2-M4 authentication, Calendar, ManualOrder, and Profile boundaries.

## Decision

Use React Navigation for the authenticated application shell. `AuthGate` remains the authentication boundary: it observes auth state and chooses loading, login, or the authenticated shell. The authenticated shell is a layout wrapper around `RootNavigator`; it does not own authentication or business state.

```text
AuthGate
  ↓
RootNavigator
  ↓
MainNavigator
  ├── Home
  ├── CalendarStack
  │    ├── WeekView
  │    ├── DaySummary
  │    └── OrderDetails
  ├── OrdersStack
  │    ├── OrdersList
  │    ├── AddOrder
  │    └── OrderDetails
    └── Profile
```

In the component tree, `AuthGate` renders `AuthenticatedAppShell` as a thin layout wrapper; that wrapper mounts `RootNavigator` and is not a separate navigation or domain boundary.

Home, Calendar, Orders, and Profile are M5's four root surfaces, presented by bottom navigation. Calendar and Orders each have a native stack. `OrderDetailsScreen` is one implementation shared by the CalendarStack and OrdersStack routes. Root controls navigate between root surfaces; nested routes stay within their owning stack and return through that stack's back behavior.

### Domain and application boundaries

Navigation is not a source of business data. Route parameters contain presentation/navigation identifiers and dates; services and domain entities remain responsible for data and state. No duplicate domain state is introduced by the shell.

`CalendarEntry` and `ManualOrder` remain separate domain concepts. CalendarEntry owns schedule/time and Calendar status. ManualOrder owns order/customer details and stores `calendarEntryId`. Creating a Calendar `external_order` uses the existing `CreateScheduledManualOrder` application service to create and link a CalendarEntry and ManualOrder. Calendar `personal` and `blocked` entries remain CalendarEntry-only. Calendar maps an `external_order` to OrderDetails through the existing `calendarEntryId` relationship. M5 does not alter the M4 domain contracts.

The MonthSelector is a presentation/navigation mechanism: selecting a date moves Calendar to the week containing that date. It does not create a month domain entity or duplicate Calendar state.

### Gesture ownership

The Calendar week pager and root horizontal pager must not compete for the same gesture. Root tab swiping is disabled on Calendar, leaving horizontal gestures there to Calendar week navigation. Root swipe remains enabled on Home, the Orders list, and Profile. It is disabled while nested Calendar routes and Orders AddOrder/OrderDetails have focus; the Orders list restores the root swipe behavior. DaySummary and all details/forms use their owning stack for their controls and back navigation.

### Android navigation setup

`MainActivity.onCreate` assigns `RNScreensFragmentFactory` to the support FragmentManager before calling `super.onCreate`. The installed `react-native-screens` 4.28.0 README recommends this setup because its screen fragments should not be restored as ordinary Activity state after Activity recreation; the factory prevents the corresponding invalid-fragment restoration path. It remains in place because M5 uses React Navigation native stacks backed by `react-native-screens`.

The Android manifest sets `android:enableOnBackInvokedCallback="false"` at application scope. Android documents this as opting out of predictive-back animations and asking the system to ignore `OnBackInvokedCallback`. React Native 0.87.1's `ReactActivity` and React Navigation's native back integration use the AndroidX `OnBackPressedDispatcher` / React Native `BackHandler` route. Keep the opt-out as a compatibility measure until the application explicitly adopts and verifies predictive-back handling; removing it would change Android system-back behavior. The M5 physical smoke test verified nested back flows on an Android device. It did not test predictive-back animation or Activity/process recreation.

References: [react-native-screens Android setup](https://github.com/software-mansion/react-native-screens/tree/v4.28.0#android), [Android predictive back](https://developer.android.com/guide/navigation/custom-back/predictive-back-gesture), [Android `enableOnBackInvokedCallback` manifest attribute](https://developer.android.com/guide/topics/manifest/application-element#enableOnBackInvokedCallback).

## Consequences

- Authenticated users land on Home; Home, Calendar, Orders, and Profile are directly reachable root surfaces.
- Calendar and Orders retain separate navigation stacks, and both reuse the single OrderDetails implementation.
- Calendar week gestures have unambiguous ownership while Calendar is active; nested routes do not accidentally page root tabs.
- M2-M4 services, domain ownership, and API contracts remain the source of business behavior and state.
- Android native navigation behavior is documented, including the predictive-back compatibility opt-out and the fact that process recreation was not part of the M5 device smoke test.
- Future root information-architecture changes are not part of M5. In particular, a possible HOME | MONEY | PROFILE structure with a seven-day Calendar on Home and a monthly Calendar overlay is a future product direction only.

## M5 scope exclusions

Finance, Expenses, Reports, Web3, camera/media, Emergency backend, GPS, Client/Marketplace, production backend, and root UI redesign are outside this decision and M5 acceptance.
