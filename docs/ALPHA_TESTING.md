# Fitness Companion private alpha test

## Install

1. Copy `frontend/android/app/build/outputs/apk/debug/app-debug.apk` to the Android phone.
2. Open the APK on the phone and allow installation from that file-manager/browser source if Android asks.
3. Install and open **Fitness Companion**. This private debug build does not need an account.

Installing a newer APK with the same debug signature should retain local data. Uninstalling the app removes its database, so export a backup from **History > Backup and restore** before uninstalling.

## First smoke test

- [ ] App opens without a storage error and navigation works.
- [ ] Add a food manually with calories and macros, then edit it.
- [ ] Scan a nutrition label, deny/allow camera permission as desired, review the detected values, and confirm before saving.
- [ ] Log a meal from Home and confirm calorie and macro totals update.
- [ ] Create a profile and nutrition plan; check all seven routine days.
- [ ] Switch between fixed-daily and flexible-weekly calorie modes.
- [ ] Add weight/body measurements and run recalibration; check that the report explains what changed or why no change was made.
- [ ] Add, edit, and remove an inventory item.
- [ ] Generate a workout plan, log sets and recovery/pain data, then run workout recalibration.
- [ ] Export a JSON backup from History and save it somewhere outside the app.
- [ ] Add a disposable record, import the backup, and confirm the disposable record disappears while prior data returns.
- [ ] Confirm **Undo last import** restores the pre-import state.
- [ ] Turn on airplane mode, restart the app, and repeat one meal and workout log.

## Report useful failures

For any issue, note the phone model, Android version, page, exact action, visible message, and whether restarting changes it. For OCR problems, keep the label photo only if it contains no personal information.
