# Edit this file to customise all personal messages.
# Changes take effect on the next server restart — no DB migration needed.

# Daily greetings: 0 = Monday … 6 = Sunday
DAY_GREETINGS: list[tuple[int, str]] = [
    (0, "Starting a new week, but keeping the energy high matters"),
    (1, "Two days in and still going strong. Keep it up!"),
    (2, "Halfway through the week. You're doing amazing aishutla!"),
    (3, "Almost weekend aalaa! Lets goooo!"),
    (4, "Friday! Nustyaaa Jhopa"),
    (5, "Weekend mode, but the goals don't take days off bubu!"),
    (6, "Rest day, but you're still a champion. SUPER Proud of you!"),
]

# Affirmations shown one per day, rotating through the list.
# Keep IDs stable (1, 2, 3 …) so edits overwrite the DB cleanly on restart.
AFFIRMATIONS: list[tuple[int, str]] = [
    (1,  "I am so proud of you Aishutlii"),
    (2,  "Your dedication is inspiring bubu. Love you!"),
    (3,  "Lets get that Snatched body. Wohoo!"),
    (4,  "You look more beauiful with every passing day!"),
    (5,  "Lets keep the rhythm going Aishutli."),
    (6,  "You are getting closer to your goal. keep it up bubu"),
    (7,  "The best project you'll ever work on is you"),
    (8,  "Your discipline is amazing, dont let it break"),
    (9,  "If you see this, then give me tight hug"),
    (10, "You need to give me a kiss if you see this"),
]

# Milestone toasts — shown when a logging event crosses a threshold.
# Keys: first_meal_today | goal_hit | streak_7 | streak_30
MILESTONE_MESSAGES: dict[str, list[str]] = {
    "first_meal_today": [
        "First meal of the day logged! Great start bubu!",
        "Day started! Keep that energy going Aishutli!",
    ],
    "goal_hit": [
        "You hit your goal today! So so proud of you!",
        "Goal reached! That's my girl!",
        "Daily goal done! You absolute champion!",
    ],
    "streak_7": [
        "7 days in a row! A whole week! I love you!",
        "One full week streak! You're unstoppable bubu!",
    ],
    "streak_30": [
        "30 DAY STREAK! You are literally incredible Aishutli!",
        "A whole month! I'm getting you something special for this!",
    ],
}

# Thinking-of-you pop-ups — shown randomly once per session.
LOVE_NOTES: list[str] = [
    "Hey, just a random reminder that I love you so much.",
    "Thinking of you right now. Hope your day is as beautiful as you are.",
    "You're my favourite person. That's all.",
    "Can't wait to see you later. Miss you already.",
    "Just checking in to say you're doing amazing and I love you.",
    "Random love note: you make everything better just by existing.",
    "I'm rooting for you always. Always always always.",
    "Being with you is my favourite thing in the world.",
]

# End-of-day notes — shown on the dashboard once at least one meal is logged.
# GOOD: consumed is at or under the daily goal
END_OF_DAY_GOOD: list[str] = [
    "You're on track today. I'm so proud of you bubu!",
    "Looking great today! Keep riding this wave.",
    "Killing it today Aishutli. Seriously.",
    "Today is a good day. You made it that way.",
    "This is what consistency looks like. You're doing it!",
]

# Weekly report messages — picked based on how the week went.
# GREAT: consumed at or under the weekly goal
WEEKLY_REPORT_GREAT: list[str] = [
    "What a week bubu! You absolutely nailed it!",
    "Perfect week Aishutli! I'm so proud of you!",
    "You stayed on track all week. That's incredible discipline!",
    "This is what a great week looks like. You're amazing bubuda!",
]

# OK: consumed within 15% over the weekly goal
WEEKLY_REPORT_OK: list[str] = [
    "Solid week overall bubu! A little over but nothing to worry about.",
    "Good effort this week Aishutli! Almost perfect.",
    "Not bad at all! A few indulgences don't undo the hard work.",
    "Decent week! Next one will be even better. I believe in you.",
]

# TOUGH: consumed more than 15% over weekly goal
WEEKLY_REPORT_TOUGH: list[str] = [
    "Tough week, but guess what — you showed up",
    "Its slightly over but we reset and go again bubu",
    "Every week is a fresh start. This one just needed more grace.",
    "Still logged it. Still here. That's all that matters",
]

# Weekly challenges — rotate automatically by ISO week number.
# Add as many as you like. They cycle back to the start when exhausted.
WEEKLY_CHALLENGES: list[str] = [
    "Try one new healthy food this week!",
    "Try a new recipe this week",
    "You need to cycle this week for cardio",
    "Find a new cardio activity this week",
    "Lets do a walk and talk session this week",
    "Try a fruit you haven't had in a while.",
]

# TOUGH: consumed has gone over the daily goal
END_OF_DAY_TOUGH: list[str] = [
    "One tough day doesn't undo all your hard work. Tomorrow, fresh start.",
    "Don't be too hard on yourself. You're doing better than you think.",
    "Every day is a new chance. We will reach our goal",
]

# Heart points: how many points each event earns
HEART_POINT_RULES: dict[str, int] = {
    "log_meal": 1,    # awarded every time any meal is logged
    "goal_hit": 3,    # bonus when daily goal is reached
    "streak_7": 10,   # bonus on a 7-day streak
    "streak_30": 25,  # bonus on a 30-day streak
}

# Rewards catalogue: (display name, point cost)
REWARDS: list[tuple[str, int]] = [
    ("Movie Night - Your Pick!", 10),
    ("5 mins massage anywhere you want", 20),
    ("Surprise gift from me", 30),
    ("Relaxing massage", 40),
    ("Shopping spree (within budget!)", 50),
    ("Spa day", 80),
    ("Weekend trip", 120),
]
