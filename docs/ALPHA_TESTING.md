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
- [ ] Scan clear English and at least one Spanish, French, German, Italian, or Portuguese label; confirm decimal commas and kJ/kcal labels use the kcal value.
- [ ] Log a meal from Home and confirm calorie and macro totals update.
- [ ] Create a profile and nutrition plan; check all seven routine days.
- [ ] Confirm plan creation succeeds without a transaction error and Today uses the current weekday&apos;s planned calories.
- [ ] Leave and reopen Plan; confirm every calculator and body-measurement field retains its last value.
- [ ] Try the physique outcome/current-state choices and confirm the recommended first phase and explanation make sense.
- [ ] Switch between fixed-daily and flexible-weekly calorie modes.
- [ ] Discard the active nutrition plan; confirm the previous plan activates, Undo works, and manual calories take over when no plan remains.
- [ ] Add weight/body measurements and run recalibration; check that the report explains what changed or why no change was made.
- [ ] Add at least two body check-ins; confirm weight and each available body-measurement chart can be selected and shows the correct dates and values.
- [ ] Enable a flex day, enter an exact calorie target, create the plan, and confirm that day uses the exact value while the seven-day total remains unchanged.
- [ ] Add, edit, and remove an inventory item.
- [ ] Add one expired item and items expiring today, within three days, and later; confirm Home and Inventory distinguish **Expired**, **Expires today**, and **Use soon** correctly.
- [ ] Open Recipes, set preferences and an avoid/allergy item, preview the prompt, and confirm expired or zero-stock ingredients are excluded.
- [ ] Share the recipe prompt to ChatGPT or Claude; cancel the share sheet once and confirm no app data changes, then complete a share and review the received pantry context.
- [ ] Open **Check recipe calories**, select several saved foods and quantities, and verify calories plus protein, carbs, fat, and fiber update correctly.
- [ ] Exit the recipe calculator and confirm nothing was logged; reopen it, commit the recipe, and confirm all ingredients appear as one meal in today&apos;s totals.
- [ ] With matching pantry stock, leave deduction unchecked and commit a recipe; confirm stock is unchanged. Repeat with deduction checked and confirm earliest-expiring usable stock is reduced while expired stock is untouched.
- [ ] In the recipe calculator choose **Today&apos;s preplanned routine**, confirm the before-recipe remainder matches Home, and confirm the after-recipe preview shows amounts left or over for calories and every planned macro.
- [ ] Open Routine, choose several weekdays, and create named breakfast, lunch, and dinner dishes from saved foods with multiple quantities.
- [ ] Confirm Routine shows each day&apos;s total and the calories/macros still needed to reach that weekday&apos;s active plan.
- [ ] Edit one source food after saving a planned dish; confirm the saved dish keeps its original nutrition snapshot until you explicitly resave it.
- [ ] On Home, confirm today&apos;s planned meals appear but do not affect totals until **Log meal** is pressed; confirm a logged slot cannot be accidentally logged twice.
- [ ] Delete the logged planned meal from History, return to Home, and confirm that planned slot can be logged again.
- [ ] Open **More > Settings**, disable **Rewards and motivation**, restart the app, and confirm prompts, love notes, challenges, and new point awards stay off while prior balance/history remain stored.
- [ ] Re-enable the master switch; independently toggle dashboard motivations, love notes, weekly challenges, and points and confirm each controls only its own feature.
- [ ] Rename the reward section and point units, set a weekly point goal, then confirm Rewards shows the configured title, units, and weekly progress.
- [ ] Change every app-detectable point action, log meals/reach a goal/complete a challenge as available, and confirm the configured awards and labels appear in recent activity.
- [ ] Add, edit, and remove reward catalogue entries; redeem an affordable reward, mark it completed, and confirm catalogue edits do not alter its saved redemption history.
- [ ] Edit several text groups, including a weekday greeting, daily motivation, weekly challenge, milestone, and redemption message; confirm the new text appears and an empty group displays nothing.
- [ ] On Home, confirm each macro card shows the amount left (or over), plus logged and target values.
- [ ] Generate a workout plan, log sets and recovery/pain data, then run workout recalibration.
- [ ] Generate plans with balanced, strength, muscle-building, endurance, hybrid, and mobility styles; confirm the sessions and prescriptions visibly change.
- [ ] Enter resistance bands as the available equipment and confirm the generated plan uses band exercises.
- [ ] Log the same strength and cardio exercise twice; confirm their progress charts offer the appropriate load/volume/reps or duration/distance metrics.
- [ ] Confirm workout creation/logging has no transaction error; restore and discard plans from workout history.
- [ ] Export a JSON backup from History and save it somewhere outside the app.
- [ ] Add a disposable record, import the backup, and confirm the disposable record disappears while prior data returns.
- [ ] Confirm **Undo last import** restores the pre-import state.
- [ ] Turn on airplane mode, restart the app, and repeat one meal and workout log.

## Report useful failures

For any issue, note the phone model, Android version, page, exact action, visible message, and whether restarting changes it. For OCR problems, keep the label photo only if it contains no personal information.
