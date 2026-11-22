-- Migration: Add 'strategy' to skill_category check constraint and insert 30 system training drills

alter table challenge_templates drop constraint if exists challenge_templates_skill_category_check;
alter table challenge_templates add constraint challenge_templates_skill_category_check check (
  skill_category in ('dinking', 'third_shot', 'serving', 'volleys', 'resets', 'conditioning', 'strategy')
);

insert into challenge_templates (
  id, scope, group_id, title, slug, description, instructions, skill_category,
  participant_format, tracking_format, score_unit, higher_is_better, default_target_goal, recommended_duration_minutes
) values
-- 1. Crosscourt Dink Streak
(
  'ch_crosscourt_dink_streak', 'system', null,
  'Crosscourt Dink Streak', 'crosscourt-dink-streak',
  'Two players dink crosscourt, focusing on consistency, a low trajectory, and controlled placement. Count consecutive successful dinks before an error.',
  'Both players position themselves at opposite kitchen lines crosscourt (even or odd court). Initiate a rally with an underhand dink. Maintain an unhurried tempo, keeping balls low over the net and landing cleanly in the kitchen. Count consecutive successful dinks exchanged before a miss or dead ball.',
  'dinking', 'partner', 'highest_score', 'dinks', true, 40, 10
),
-- 2. Dink Target Practice
(
  'ch_dink_target_practice', 'system', null,
  'Dink Target Practice', 'dink-target-practice',
  'Place targets in the opponent''s kitchen. Players attempt to land dinks in specific zones, alternating between crosscourt, middle, and sideline placements.',
  'Place target cones or markers in three kitchen zones: crosscourt corner, middle T, and sideline. Feed or dink 20 practice balls targeting the designated zones in rotation. Record how many dinks land accurately inside the target zone out of 20 total attempts.',
  'dinking', 'individual', 'accuracy', 'targets', true, 14, 15
),
-- 3. Backhand Dink Challenge
(
  'ch_backhand_dink_challenge', 'system', null,
  'Backhand Dink Challenge', 'backhand-dink-challenge',
  'Players dink crosscourt using only their backhands. Focus on a relaxed grip, soft contact, and consistent placement.',
  'Position crosscourt with a partner. Both players must exclusively use backhand dinks with a loose grip pressure (around 3-4 out of 10) and compact pushing motion. Count total consecutive backhand dinks exchanged without a fault.',
  'dinking', 'partner', 'highest_score', 'dinks', true, 30, 10
),
-- 4. Dink and Speed Up
(
  'ch_dink_and_speed_up', 'system', null,
  'Dink and Speed Up', 'dink-and-speed-up',
  'Players sustain a dink rally for at least five shots before one player initiates a speed-up. Practice recognizing attackable balls and responding to counterattacks.',
  'Rally crosscourt or straight-on for a minimum of 5 neutral dinks. Once a ball bounces high or sits dead in the kitchen, either player may initiate a controlled speed-up. Play out the point to completion. Log points or mini-games won in your practice session.',
  'dinking', 'partner', 'wins', 'points', true, 7, 15
),
-- 5. Dink Under Pressure
(
  'ch_dink_under_pressure', 'system', null,
  'Dink Under Pressure', 'dink-under-pressure',
  'Two players dink crosscourt while trying to move their opponent around the kitchen. Focus on maintaining balance, recovering to position, and avoiding pop-ups.',
  'Rally crosscourt aggressively moving the ball from wide sideline to middle T. Players must stay low, maintain balance with split-steps, and avoid floating pop-ups. Count the maximum consecutive shots exchanged before an error or pop-up.',
  'dinking', 'partner', 'highest_score', 'shots', true, 25, 15
),
-- 6. Short and Deep Dinks
(
  'ch_short_and_deep_dinks', 'system', null,
  'Short and Deep Dinks', 'short-and-deep-dinks',
  'Players alternate between short dinks near the net and deeper dinks toward the back of the kitchen. Practice changing depth without sacrificing consistency.',
  'Rally with a partner alternating depths: 1 short dink dying just over the net followed by 1 deep dink landing right in front of the kitchen line at opponent feet. Count total consecutive alternating dinks maintained without missing.',
  'dinking', 'partner', 'highest_score', 'dinks', true, 20, 10
),
-- 7. Third-Shot Drop Repetition
(
  'ch_third_shot_drop_repetition', 'system', null,
  'Third-Shot Drop Repetition', 'third-shot-drop-repetition',
  'One player or team starts at the baseline while the opposing team feeds returns. Practice hitting third-shot drops into the kitchen with enough height to clear the net safely.',
  'Start at the baseline. Feed or have a partner hit deep returns to you. Hit 20 third-shot drops with enough arc for safe net clearance so the ball descends softly into the kitchen. Record successful drops landed inside the kitchen out of 20.',
  'third_shot', 'individual', 'accuracy', 'drops', true, 15, 15
),
-- 8. Drop and Advance
(
  'ch_drop_and_advance', 'system', null,
  'Drop and Advance', 'drop-and-advance',
  'Hit a third-shot drop, then move forward with controlled footwork. Practice taking ground while maintaining balance and reaching the kitchen line.',
  'Hit a baseline third-shot drop, advance into transition, split-step on opponent contact, and progress to the kitchen line on successive shots while staying on balance. Record completed successful transitions to the kitchen out of 10 attempts.',
  'third_shot', 'individual', 'accuracy', 'advances', true, 8, 15
),
-- 9. Third-Shot Drop Placement
(
  'ch_third_shot_drop_placement', 'system', null,
  'Third-Shot Drop Placement', 'third-shot-drop-placement',
  'Practice hitting drops to three target zones: opponent''s backhand, middle, and outside foot. Focus on placement rather than power.',
  'Set 3 designated target zones in the opposing kitchen: opponent backhand, middle T, and outside foot. From the baseline, hit 15 drops (5 to each zone in rotation). Record how many successfully hit the target zone out of 15.',
  'third_shot', 'individual', 'accuracy', 'targets', true, 10, 15
),
-- 10. Drop vs. Drive Decision
(
  'ch_drop_vs_drive_decision', 'system', null,
  'Drop vs. Drive Decision', 'drop-vs-drive-decision',
  'A feeder sends different types of returns. The player decides whether to hit a third-shot drop or drive based on the return''s depth, height, and position.',
  'Feeder sends 20 varied returns (short vs deep, high floaters vs skidders). On short or high balls, hit an aggressive third-shot drive; on deep or low skidding balls, hit a controlled third-shot drop. Record correct decision-and-execution reps out of 20.',
  'third_shot', 'partner', 'accuracy', 'shots', true, 16, 15
),
-- 11. Five-Ball Transition Drill
(
  'ch_five_ball_transition_drill', 'system', null,
  'Five-Ball Transition Drill', 'five-ball-transition-drill',
  'Start at the baseline and hit a sequence of five transition shots while moving toward the kitchen. Focus on controlled drops and resets rather than rushing forward.',
  'Start at baseline. Partner hits 5 consecutive balls with pace as you step forward: Shot 1 (baseline drop), Shot 2 (deep transition), Shot 3 (mid transition reset), Shot 4 (shallow transition reset), Shot 5 (kitchen volley/dink). Record consecutive successful 5-ball sequences completed.',
  'third_shot', 'partner', 'highest_score', 'sequences', true, 5, 15
),
-- 12. Return, Drop, and Dink
(
  'ch_return_drop_and_dink', 'system', null,
  'Return, Drop, and Dink', 'return-drop-and-dink',
  'Play out the first few shots of a doubles rally: return of serve, third-shot drop, fourth-shot response, and fifth-shot continuation. Reset after each sequence.',
  'Server serves, receiver returns deep and advances to kitchen, server team hits 3rd shot drop, receiving team responds with 4th shot dink/roll, and serving team neutralizes with 5th shot. Count completed 5-shot sequences executed cleanly without an unforced error.',
  'third_shot', 'partner', 'highest_score', 'rallies', true, 10, 20
),
-- 13. Reset Master
(
  'ch_reset_master', 'system', null,
  'Reset Master', 'reset-master',
  'One player attacks from the kitchen while the other practices resetting the ball into the opponent''s kitchen. Focus on absorbing pace and keeping the ball low.',
  'Defender stands in mid-court transition zone. Attacker at opposite kitchen line attacks with firm pace. Defender absorbs the pace with a soft grip and paddle face pointed into opponent kitchen. Count consecutive successful unattackable resets landed in the kitchen.',
  'resets', 'partner', 'highest_score', 'resets', true, 15, 15
),
-- 14. Transition Zone Resets
(
  'ch_transition_zone_resets', 'system', null,
  'Transition Zone Resets', 'transition-zone-resets',
  'Start around the middle of the court between the baseline and kitchen. A feeder attacks at different speeds and angles while the player practices resetting without popping the ball up.',
  'Position yourself in the transition zone (no-man''s land). Feeder attacks 20 balls at varied heights and speeds. Reset each ball softly below net height into the kitchen. Record successful resets landed cleanly in the kitchen out of 20 attempts.',
  'resets', 'partner', 'accuracy', 'resets', true, 14, 15
),
-- 15. Reset Under Pressure
(
  'ch_reset_under_pressure', 'system', null,
  'Reset Under Pressure', 'reset-under-pressure',
  'One team attacks continuously while the defending team attempts to reset every attack into the kitchen. Continue until the defending team earns control of the rally or makes an error.',
  'Attacking team starts at kitchen line; defending team starts in transition zone. Attacking team attacks continuously. Defending team resets until they drop a ball short enough to earn their way forward and establish position at the kitchen. Count successful transitions won or consecutive resets.',
  'resets', 'partner', 'highest_score', 'resets', true, 10, 15
),
-- 16. Block and Counter
(
  'ch_block_and_counter', 'system', null,
  'Block and Counter', 'block-and-counter',
  'One player hits controlled speed-ups while the opponent practices blocking the ball back. Once comfortable, progress to counterattacking attackable balls.',
  'Partner at the kitchen line hits speed-ups from below or above the net. Defender practices blocking with a quiet paddle face. When an attack is hit high or floating, defender counters aggressively out of the air. Count highest consecutive blocks or points won.',
  'resets', 'partner', 'highest_score', 'blocks', true, 15, 15
),
-- 17. Defensive Footwork
(
  'ch_defensive_footwork', 'system', null,
  'Defensive Footwork', 'defensive-footwork',
  'A feeder directs balls toward the player''s forehand, backhand, and body. Practice getting into position, staying balanced, and returning the ball with control.',
  'Feeder fires 20 rapid balls forcing quick lateral split-steps: 7 to wide forehand, 7 to wide backhand, and 6 directly at paddle hip. Move feet, stay balanced, and return each ball cleanly into play. Record controlled returns out of 20 attempts.',
  'resets', 'individual', 'accuracy', 'returns', true, 16, 15
),
-- 18. Volley Rally Challenge
(
  'ch_volley_rally_challenge', 'system', null,
  'Volley Rally Challenge', 'volley-rally-challenge',
  'Two players stand at the kitchen line and volley continuously without letting the ball bounce. Focus on compact swings and controlled contact.',
  'Both players stand opposite each other at the kitchen line. Volley the ball back and forth continuously out of the air with no bounce. Keep paddle swings short (push, don''t swing). Count total consecutive volleys without the ball touching the ground.',
  'volleys', 'partner', 'highest_score', 'volleys', true, 50, 10
),
-- 19. Hand Speed Battle
(
  'ch_hand_speed_battle', 'system', null,
  'Hand Speed Battle', 'hand-speed-battle',
  'Two players exchange progressively faster volleys at the kitchen line. Keep the paddle in front and use short, controlled movements.',
  'Both players start at the kitchen line with paddles up in ready position. Start with moderate volleys and increase pace every 5 shots to maximum hand speed. Count highest consecutive speed-volley exchanges before an unforced error.',
  'volleys', 'partner', 'highest_score', 'volleys', true, 25, 10
),
-- 20. Body Bag Defense
(
  'ch_body_bag_defense', 'system', null,
  'Body Bag Defense', 'body-bag-defense',
  'One player targets the opponent''s body with controlled volleys while the opponent practices blocking and redirecting the ball.',
  'Attacker hits firm volleys targeting defender''s chest, paddle hip, and ribs. Defender uses quick paddle chicken-wing slides and punch blocks to redirect the ball safely into the opposite kitchen. Record successful defensive deflections out of 20 attempts.',
  'volleys', 'partner', 'accuracy', 'blocks', true, 15, 10
),
-- 21. Attack and Counter
(
  'ch_attack_and_counter', 'system', null,
  'Attack and Counter', 'attack-and-counter',
  'One player initiates a speed-up, and the other practices countering or blocking. Alternate roles after each rally.',
  'Players start dinking at the kitchen. Player A initiates a speed-up; Player B counters out of the air. Rally continues until point ends. Alternate roles every 5 points. Play a game to 7 or record total counter points won.',
  'volleys', 'partner', 'wins', 'points', true, 7, 15
),
-- 22. Alternating Volley Targets
(
  'ch_alternating_volley_targets', 'system', null,
  'Alternating Volley Targets', 'alternating-volley-targets',
  'Players volley while alternating between the opponent''s forehand, backhand, and middle. Focus on placement and quick recovery.',
  'Kitchen line volley exchange where one player intentionally alternates placement: 1 to opponent forehand wing, 1 to middle, 1 to backhand wing. Count successful 3-target cycles completed without a miss.',
  'volleys', 'partner', 'highest_score', 'cycles', true, 8, 15
),
-- 23. Deep Serve Challenge
(
  'ch_deep_serve_challenge', 'system', null,
  'Deep Serve Challenge', 'deep-serve-challenge',
  'Hit 10 serves toward the back third of the service box. Focus on depth, consistency, and placement.',
  'Mark the deep third of the service box (within 3-4 feet of baseline). Hit 10 serves from the right court and 10 from the left court (20 total). Record how many land cleanly in the deep target zone.',
  'serving', 'individual', 'accuracy', 'serves', true, 15, 15
),
-- 24. Serve Placement Challenge
(
  'ch_serve_placement_challenge', 'system', null,
  'Serve Placement Challenge', 'serve-placement-challenge',
  'Choose target zones in the service box and attempt to hit each one. Alternate between wide serves, middle serves, and serves toward the opponent''s backhand.',
  'Set 3 targets in the opponent service court: wide corner, center T, and deep backhand. Attempt 15 serves calling your target before each stroke (5 per zone). Record successful hits on the designated target out of 15.',
  'serving', 'individual', 'accuracy', 'targets', true, 10, 15
),
-- 25. Deep Return Challenge
(
  'ch_deep_return_challenge', 'system', null,
  'Deep Return Challenge', 'deep-return-challenge',
  'Practice returning serves deep toward the baseline. Focus on height, depth, and giving yourself enough time to reach the kitchen line.',
  'Face 20 regulation serves. Return each serve with good net clearance aiming for the back 4 feet of the baseline, then immediately advance to the kitchen line. Record returns that land deep in the target zone out of 20.',
  'serving', 'partner', 'accuracy', 'returns', true, 15, 15
),
-- 26. Return Placement Challenge
(
  'ch_return_placement_challenge', 'system', null,
  'Return Placement Challenge', 'return-placement-challenge',
  'Return serves toward three target zones: opponent''s backhand, middle, and sideline. Prioritize placement over power.',
  'Receiver faces 15 serves and alternates placement between 3 designated zones: server''s backhand, deep middle, and deep sideline. Prioritize shape and depth over speed. Record accurate target returns out of 15.',
  'serving', 'partner', 'accuracy', 'targets', true, 11, 15
),
-- 27. Seven-Shot Patience
(
  'ch_seven_shot_patience', 'system', null,
  'Seven-Shot Patience', 'seven-shot-patience',
  'Play doubles rallies where neither team is allowed to speed up before the seventh shot. Practice building the point patiently and recognizing opportunities to attack.',
  'Play doubles rallies starting with serve, return, 3rd drop, 4th response, 5th, and 6th dinks. Neither team may hit an offensive speed-up until ball 7 or later. Any premature attack awards a point to opponents. Play a game to 11 points or record patience rallies won.',
  'strategy', 'group', 'wins', 'points', true, 11, 20
),
-- 28. Skinny Singles
(
  'ch_skinny_singles', 'system', null,
  'Skinny Singles', 'skinny-singles',
  'Play singles using only one half of the court. Practice shot placement, footwork, consistency, and exploiting open space.',
  'Play singles restricted to one half of the court (crosscourt or down-the-line depending on server score). All standard pickleball rules apply within the designated half. Play a match to 11 points (win by 2) and record games or match points won.',
  'strategy', 'partner', 'wins', 'games', true, 2, 20
),
-- 29. Attack vs. Defense
(
  'ch_attack_vs_defense', 'system', null,
  'Attack vs. Defense', 'attack-vs-defense',
  'One team starts at the kitchen line while the other starts at the baseline or transition zone. The kitchen team attacks while the defending team tries to reset and earn their way forward.',
  'Team A starts at the kitchen line; Team B starts at baseline. Team A initiates and attacks with drives and volleys. Team B must reset, drop, and earn their way forward to the kitchen line. Switch positions every 5 points. Record points won as the defending team.',
  'strategy', 'group', 'highest_score', 'points', true, 8, 20
),
-- 30. Situational Doubles
(
  'ch_situational_doubles', 'system', null,
  'Situational Doubles', 'situational-doubles',
  'Start rallies from specific scenarios, such as serving team at the baseline, one player stuck in transition, or both teams at the kitchen. Play out each situation and discuss positioning and shot selection afterward.',
  'Run structured point scenarios (poach coverage, 3rd shot drive & crash, 1 player trapped in transition). Play out each point to completion, award 1 point to the winning side, and rotate scenarios every 4 points. Record total scenarios won in the session.',
  'strategy', 'group', 'wins', 'points', true, 10, 25
)
on conflict (id) do update set
  title = excluded.title,
  slug = excluded.slug,
  description = excluded.description,
  instructions = excluded.instructions,
  skill_category = excluded.skill_category,
  participant_format = excluded.participant_format,
  tracking_format = excluded.tracking_format,
  score_unit = excluded.score_unit,
  higher_is_better = excluded.higher_is_better,
  default_target_goal = excluded.default_target_goal,
  recommended_duration_minutes = excluded.recommended_duration_minutes,
  updated_at = now();
