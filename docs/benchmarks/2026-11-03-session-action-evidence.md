# Session action latency: complete measurements

All times are milliseconds. Every accepted primary observation is retained in acquisition order. Each raw JSON includes every query interval and request, not only representatives. No candidate timing samples are excluded. [Stopping audit](data/session-actions/stopping-audit.json).

## control

[All60 observations, request/query intervals and secondary events](data/session-actions/control.json).

| Viewport / action | Observations (10) | Median | Range |
| --- | --- | ---: | ---: |
| desktop / start | 1229, 1138, 1182, 1365, 1330, 1139, 1164, 1597, 1446, 1147 | 1,205.5 | 1,138–1,597 |
| desktop / save-all | 970, 2301, 1101, 876, 1084, 1087, 861, 1139, 1297, 978 | 1,085.5 | 861–2,301 |
| desktop / next | 1404, 1392, 1520, 1731, 1374, 1528, 1497, 1817, 1744, 1541 | 1,524 | 1,374–1,817 |
| narrow / start | 1143, 1127, 1100, 1361, 1192, 1213, 1123, 1112, 1180, 1285 | 1,161.5 | 1,100–1,361 |
| narrow / save-all | 906, 934, 1034, 894, 803, 836, 908, 895, 823, 825 | 894.5 | 803–1,034 |
| narrow / next | 1590, 1614, 1437, 1350, 1381, 1465, 1379, 1394, 1370, 1381 | 1,387.5 | 1,350–1,614 |

## prepared

[All60 observations, request/query intervals and secondary events](data/session-actions/prepared.json).

| Viewport / action | Observations (10) | Median | Range |
| --- | --- | ---: | ---: |
| desktop / start | 1249, 1113, 917, 1023, 847, 902, 1062, 657, 732, 725 | 909.5 | 657–1,249 |
| desktop / save-all | 797, 961, 1315, 845, 918, 927, 800, 753, 747, 718 | 822.5 | 718–1,315 |
| desktop / next | 1625, 1332, 1421, 1274, 1036, 1163, 1232, 1128, 1078, 1034 | 1,197.5 | 1,034–1,625 |
| narrow / start | 1872, 1078, 677, 692, 1144, 1164, 978, 724, 847, 729 | 912.5 | 677–1,872 |
| narrow / save-all | 1323, 917, 672, 888, 1778, 999, 856, 611, 724, 866 | 877 | 611–1,778 |
| narrow / next | 1595, 1214, 1835, 1682, 1494, 1209, 1328, 1175, 1503, 1556 | 1,498.5 | 1,175–1,835 |

## replay

[All60 observations, request/query intervals and secondary events](data/session-actions/replay.json).

| Viewport / action | Observations (10) | Median | Range |
| --- | --- | ---: | ---: |
| desktop / start | 1274, 1062, 714, 945, 1748, 1104, 940, 942, 643, 883 | 943.5 | 643–1,748 |
| desktop / save-all | 914, 1356, 585, 983, 793, 757, 802, 695, 569, 615 | 775 | 569–1,356 |
| desktop / next | 1327, 1346, 5172, 1311, 1441, 1024, 1451, 1335, 1093, 1457 | 1,340.5 | 1,024–5,172 |
| narrow / start | 1106, 839, 1317, 650, 851, 693, 803, 765, 711, 777 | 790 | 650–1,317 |
| narrow / save-all | 817, 539, 902, 908, 744, 738, 667, 605, 629, 636 | 702.5 | 539–908 |
| narrow / next | 1549, 1125, 1360, 1264, 1179, 1293, 1127, 1147, 1017, 1409 | 1,221.5 | 1,017–1,549 |

## round

[All60 observations, request/query intervals and secondary events](data/session-actions/round.json).

| Viewport / action | Observations (10) | Median | Range |
| --- | --- | ---: | ---: |
| desktop / start | 969, 925, 918, 1021, 709, 621, 743, 666, 882, 636 | 812.5 | 621–1,021 |
| desktop / save-all | 848, 1168, 822, 710, 1276, 1063, 880, 777, 569, 881 | 864 | 569–1,276 |
| desktop / next | 1490, 1215, 1406, 1596, 1129, 1242, 1224, 1234, 1344, 1332 | 1,287 | 1,129–1,596 |
| narrow / start | 1213, 1165, 740, 614, 791, 837, 631, 737, 644, 591 | 738.5 | 591–1,213 |
| narrow / save-all | 837, 920, 667, 1041, 1000, 685, 739, 675, 695, 653 | 717 | 653–1,041 |
| narrow / next | 1989, 1378, 1182, 1265, 1422, 975, 1173, 1159, 961, 943 | 1,177.5 | 943–1,989 |

## rating

[All60 observations, request/query intervals and secondary events](data/session-actions/rating.json).

| Viewport / action | Observations (10) | Median | Range |
| --- | --- | ---: | ---: |
| desktop / start | 835, 833, 673, 887, 975, 751, 764, 619, 658, 566 | 757.5 | 566–975 |
| desktop / save-all | 990, 834, 554, 2117, 693, 683, 664, 706, 1009, 538 | 699.5 | 538–2,117 |
| desktop / next | 1195, 1284, 1318, 1354, 1077, 1287, 1259, 1214, 1010, 1000 | 1,236.5 | 1,000–1,354 |
| narrow / start | 1037, 921, 641, 697, 708, 720, 863, 731, 837, 671 | 725.5 | 641–1,037 |
| narrow / save-all | 1155, 814, 564, 563, 533, 520, 522, 428, 540, 591 | 551.5 | 428–1,155 |
| narrow / next | 1621, 1092, 919, 1169, 1023, 1004, 1066, 1068, 1289, 1225 | 1,080 | 919–1,621 |

## chemistry

[All60 observations, request/query intervals and secondary events](data/session-actions/chemistry.json).

| Viewport / action | Observations (10) | Median | Range |
| --- | --- | ---: | ---: |
| desktop / start | 971, 955, 919, 770, 737, 828, 675, 607, 661, 691 | 753.5 | 607–971 |
| desktop / save-all | 756, 916, 930, 1017, 898, 564, 993, 523, 718, 1379 | 907 | 523–1,379 |
| desktop / next | 1265, 1227, 1199, 1168, 1109, 1322, 1042, 1049, 1245, 902 | 1,183.5 | 902–1,322 |
| narrow / start | 1001, 1075, 910, 879, 576, 916, 805, 716, 573, 620 | 842 | 573–1,075 |
| narrow / save-all | 810, 949, 799, 886, 787, 919, 619, 680, 562, 721 | 793 | 562–949 |
| narrow / next | 1664, 1439, 1047, 1167, 963, 1130, 1183, 1043, 876, 1467 | 1,148.5 | 876–1,664 |

## history

[All60 observations, request/query intervals and secondary events](data/session-actions/history.json).

| Viewport / action | Observations (10) | Median | Range |
| --- | --- | ---: | ---: |
| desktop / start | 1043, 753, 847, 615, 620, 601, 652, 613, 544, 664 | 636 | 544–1,043 |
| desktop / save-all | 905, 908, 606, 613, 786, 514, 1183, 609, 648, 626 | 637 | 514–1,183 |
| desktop / next | 1721, 1039, 1208, 1076, 959, 1075, 961, 884, 1084, 1000 | 1,057 | 884–1,721 |
| narrow / start | 1092, 771, 591, 593, 637, 1155, 977, 586, 543, 640 | 638.5 | 543–1,155 |
| narrow / save-all | 868, 768, 664, 664, 595, 521, 1404, 664, 744, 659 | 664 | 521–1,404 |
| narrow / next | 1289, 1018, 936, 927, 1213, 1182, 961, 904, 1132, 876 | 989.5 | 876–1,289 |

## Every optimization versus best verified prior measurement

Positive delta means a lower observed median. Overlapping ranges always mean INCONCLUSIVE, including lower medians over5percent. Best prior uses the lowest observed median, not a claim of a statistically established winner.

| Attempt | Viewport / action | Targeted? | Best prior / median | Candidate median | Saved ms | Saved percent | Conclusion |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| prepared | desktop / start | yes | control / 1,205.5 | 909.5 | 296 | 24.6% | INCONCLUSIVE (ranges overlap) |
| prepared | desktop / save-all | yes | control / 1,085.5 | 822.5 | 263 | 24.2% | INCONCLUSIVE (ranges overlap) |
| prepared | desktop / next | yes | control / 1,524 | 1,197.5 | 326.5 | 21.4% | INCONCLUSIVE (ranges overlap) |
| prepared | narrow / start | yes | control / 1,161.5 | 912.5 | 249 | 21.4% | INCONCLUSIVE (ranges overlap) |
| prepared | narrow / save-all | yes | control / 894.5 | 877 | 17.5 | 2% | INCONCLUSIVE (ranges overlap) |
| prepared | narrow / next | yes | control / 1,387.5 | 1,498.5 | -111 | -8% | INCONCLUSIVE (ranges overlap) |
| replay | desktop / start | no | prepared / 909.5 | 943.5 | -34 | -3.7% | INCONCLUSIVE (ranges overlap) |
| replay | desktop / save-all | yes | prepared / 822.5 | 775 | 47.5 | 5.8% | INCONCLUSIVE (ranges overlap) |
| replay | desktop / next | yes | prepared / 1,197.5 | 1,340.5 | -143 | -11.9% | INCONCLUSIVE (ranges overlap) |
| replay | narrow / start | no | prepared / 912.5 | 790 | 122.5 | 13.4% | INCONCLUSIVE (ranges overlap) |
| replay | narrow / save-all | yes | prepared / 877 | 702.5 | 174.5 | 19.9% | INCONCLUSIVE (ranges overlap) |
| replay | narrow / next | yes | control / 1,387.5 | 1,221.5 | 166 | 12% | INCONCLUSIVE (ranges overlap) |
| round | desktop / start | yes | prepared / 909.5 | 812.5 | 97 | 10.7% | INCONCLUSIVE (ranges overlap) |
| round | desktop / save-all | no | replay / 775 | 864 | -89 | -11.5% | INCONCLUSIVE (ranges overlap) |
| round | desktop / next | no | prepared / 1,197.5 | 1,287 | -89.5 | -7.5% | INCONCLUSIVE (ranges overlap) |
| round | narrow / start | yes | replay / 790 | 738.5 | 51.5 | 6.5% | INCONCLUSIVE (ranges overlap) |
| round | narrow / save-all | no | replay / 702.5 | 717 | -14.5 | -2.1% | INCONCLUSIVE (ranges overlap) |
| round | narrow / next | no | replay / 1,221.5 | 1,177.5 | 44 | 3.6% | INCONCLUSIVE (ranges overlap) |
| rating | desktop / start | no | round / 812.5 | 757.5 | 55 | 6.8% | INCONCLUSIVE (ranges overlap) |
| rating | desktop / save-all | yes | replay / 775 | 699.5 | 75.5 | 9.7% | INCONCLUSIVE (ranges overlap) |
| rating | desktop / next | no | prepared / 1,197.5 | 1,236.5 | -39 | -3.3% | INCONCLUSIVE (ranges overlap) |
| rating | narrow / start | no | round / 738.5 | 725.5 | 13 | 1.8% | INCONCLUSIVE (ranges overlap) |
| rating | narrow / save-all | yes | replay / 702.5 | 551.5 | 151 | 21.5% | INCONCLUSIVE (ranges overlap) |
| rating | narrow / next | no | round / 1,177.5 | 1,080 | 97.5 | 8.3% | INCONCLUSIVE (ranges overlap) |
| chemistry | desktop / start | no | rating / 757.5 | 753.5 | 4 | 0.5% | INCONCLUSIVE (ranges overlap) |
| chemistry | desktop / save-all | no | rating / 699.5 | 907 | -207.5 | -29.7% | INCONCLUSIVE (ranges overlap) |
| chemistry | desktop / next | yes | prepared / 1,197.5 | 1,183.5 | 14 | 1.2% | INCONCLUSIVE (ranges overlap) |
| chemistry | narrow / start | no | rating / 725.5 | 842 | -116.5 | -16.1% | INCONCLUSIVE (ranges overlap) |
| chemistry | narrow / save-all | no | rating / 551.5 | 793 | -241.5 | -43.8% | INCONCLUSIVE (ranges overlap) |
| chemistry | narrow / next | yes | rating / 1,080 | 1,148.5 | -68.5 | -6.3% | INCONCLUSIVE (ranges overlap) |
| history | desktop / start | yes | chemistry / 753.5 | 636 | 117.5 | 15.6% | INCONCLUSIVE (ranges overlap) |
| history | desktop / save-all | no | rating / 699.5 | 637 | 62.5 | 8.9% | INCONCLUSIVE (ranges overlap) |
| history | desktop / next | yes | chemistry / 1,183.5 | 1,057 | 126.5 | 10.7% | INCONCLUSIVE (ranges overlap) |
| history | narrow / start | yes | rating / 725.5 | 638.5 | 87 | 12% | INCONCLUSIVE (ranges overlap) |
| history | narrow / save-all | no | rating / 551.5 | 664 | -112.5 | -20.4% | INCONCLUSIVE (ranges overlap) |
| history | narrow / next | yes | rating / 1,080 | 989.5 | 90.5 | 8.4% | INCONCLUSIVE (ranges overlap) |

## control: representative request and every SQL interval

Offsets start at the actual click. Representatives are nearest their own action/viewport median, rather than sums of medians. Parallel intervals overlap. Full request span contains queries and streamed server rendering; never add nested spans.

### desktop / start, round1

DOM 1,229; server request 1,219.4; request/response body wrapper bytes 573/3904; browser first-byte→DOM 314.5; server-before-DOM time with no outstanding SQL 32.9. The latter includes compute, rendering, scheduling and instrumentation, rather than pure CPU.

| SQL | Class / tables | Start offset | End offset | Wall time |
| ---: | --- | ---: | ---: | ---: |
| 1 | read / sessions | 10.6 | 84.3 | 73.7 |
| 2 | read / group_organizers, groups | 85.8 | 159.2 | 73.4 |
| 3 | transaction /  | 160.6 | 301 | 140.4 |
| 4 | read / sessions | 302.1 | 373.8 | 71.7 |
| 5 | read / rounds | 376.4 | 448 | 71.6 |
| 6 | source-write / rounds | 448.8 | 525.9 | 77.1 |
| 7 | source-write / matches | 526.4 | 601.6 | 75.2 |
| 8 | snapshot-write / match_players | 602.4 | 675.3 | 72.9 |
| 9 | source-write / sessions | 676.9 | 866.8 | 189.9 |
| 10 | transaction /  | 867.2 | 903.4 | 36.2 |
| 11 | read / groups | 914.5 | 988.5 | 74.1 |
| 12 | read / sessions | 914.5 | 990.8 | 76.3 |
| 13 | read / player_accounts, players | 914.6 | 992.5 | 77.9 |
| 14 | read / rounds | 914.6 | 989 | 74.4 |
| 15 | read / session_attendance | 914.6 | 992.3 | 77.7 |
| 16 | read / matches | 989.6 | 1,061.8 | 72.2 |
| 17 | read / match_players, matches | 989.7 | 1,064.4 | 74.7 |
| 18 | read / round_sits | 989.8 | 1,063.4 | 73.7 |
| 19 | read / group_organizers, groups | 1,065 | 1,137.3 | 72.3 |
| 20 | read / session_partner_requests | 1,137.5 | 1,219.7 | 82.2 |
| 21 | read / player_synergy | 1,137.6 | 1,218.1 | 80.6 |

### desktop / save-all, round5

DOM 1,084; server request 1,468.6; request/response body wrapper bytes 388/5601; browser first-byte→DOM 6.5; server-before-DOM time with no outstanding SQL 21.6. The latter includes compute, rendering, scheduling and instrumentation, rather than pure CPU.

| SQL | Class / tables | Start offset | End offset | Wall time |
| ---: | --- | ---: | ---: | ---: |
| 1 | read / group_organizers, groups | 8.6 | 81.8 | 73.3 |
| 2 | transaction /  | 82.4 | 117.5 | 35.1 |
| 3 | lock-call /  | 117.9 | 234.3 | 116.3 |
| 4 | read / matches, rounds, sessions | 234.7 | 306.8 | 72.1 |
| 5 | source-write / matches, unnest | 307.6 | 379.8 | 72.2 |
| 6 | read / player_accounts, players | 380.4 | 418.7 | 38.3 |
| 7 | read / match_players, matches, rounds, sessions | 419.2 | 830.1 | 410.8 |
| 8 | rating-write / desired_accounts, desired_players, desired_rosters, player_accounts, players, unnest | 834.3 | 908.2 | 73.9 |
| 9 | snapshot-write / desired_snapshots, match_players, matches, rounds, sessions, targets, unnest | 909.2 | 1,031.8 | 122.5 |
| 10 | transaction /  | 1,034.1 | 1,070.5 | 36.4 |
| 11 | read / groups | 1,077.5 | 1,154.7 | 77.2 |
| 12 | read / sessions | 1,077.7 | 1,149.6 | 71.9 |
| 13 | read / player_accounts, players | 1,077.8 | 1,154.3 | 76.6 |
| 14 | read / rounds | 1,077.8 | 1,154.4 | 76.6 |
| 15 | read / session_attendance | 1,077.8 | 1,154.2 | 76.4 |
| 16 | read / matches | 1,154.5 | 1,317 | 162.5 |
| 17 | read / match_players, matches | 1,154.6 | 1,317.5 | 162.9 |
| 18 | read / round_sits | 1,154.6 | 1,314.2 | 159.6 |
| 19 | read / group_organizers, groups | 1,318 | 1,392.7 | 74.7 |
| 20 | read / session_partner_requests | 1,393 | 1,467.6 | 74.5 |
| 21 | read / player_synergy | 1,393.1 | 1,470.4 | 77.4 |

### desktop / next, round3

DOM 1,520; server request 1,513.9; request/response body wrapper bytes 199/5100; browser first-byte→DOM 449.8; server-before-DOM time with no outstanding SQL 84.1. The latter includes compute, rendering, scheduling and instrumentation, rather than pure CPU.

| SQL | Class / tables | Start offset | End offset | Wall time |
| ---: | --- | ---: | ---: | ---: |
| 1 | read / sessions | 5.6 | 176.5 | 170.9 |
| 2 | read / rounds | 176.7 | 260.3 | 83.6 |
| 3 | read / group_organizers, groups | 261.9 | 337.1 | 75.2 |
| 4 | transaction /  | 337.7 | 380.4 | 42.7 |
| 5 | lock-call /  | 380.8 | 418.3 | 37.4 |
| 6 | read / match_players, matches, rounds | 418.8 | 494 | 75.2 |
| 7 | source-write / rounds | 494.8 | 570.8 | 76 |
| 8 | lock-call /  | 571.2 | 700.1 | 128.9 |
| 9 | read / player_accounts, players | 700.6 | 752.9 | 52.3 |
| 10 | read / match_players, matches, rounds, sessions | 753.4 | 903.7 | 150.4 |
| 11 | chemistry-write / player_synergy | 910.2 | 946.8 | 36.5 |
| 12 | chemistry-write / player_synergy, unnest | 947.2 | 1,025.4 | 78.2 |
| 13 | transaction /  | 1,025.8 | 1,063.3 | 37.5 |
| 14 | read / groups | 1,070 | 1,224.4 | 154.4 |
| 15 | read / sessions | 1,070 | 1,224.7 | 154.7 |
| 16 | read / player_accounts, players | 1,070 | 1,227.2 | 157.1 |
| 17 | read / rounds | 1,070.1 | 1,225.7 | 155.6 |
| 18 | read / session_attendance | 1,070.1 | 1,227.3 | 157.3 |
| 19 | read / matches | 1,226.1 | 1,302.4 | 76.4 |
| 20 | read / match_players, matches | 1,226.1 | 1,304.6 | 78.5 |
| 21 | read / round_sits | 1,226.2 | 1,300.7 | 74.5 |
| 22 | read / group_organizers, groups | 1,305.3 | 1,380.8 | 75.5 |
| 23 | read / session_partner_requests | 1,381 | 1,455.1 | 74.1 |
| 24 | read / player_synergy | 1,381.1 | 1,455.8 | 74.8 |

### narrow / start, round1

DOM 1,143; server request 1,129.1; request/response body wrapper bytes 574/3914; browser first-byte→DOM 310.7; server-before-DOM time with no outstanding SQL 30.4. The latter includes compute, rendering, scheduling and instrumentation, rather than pure CPU.

| SQL | Class / tables | Start offset | End offset | Wall time |
| ---: | --- | ---: | ---: | ---: |
| 1 | read / sessions | 9.3 | 82.5 | 73.2 |
| 2 | read / group_organizers, groups | 83.5 | 154.9 | 71.3 |
| 3 | transaction /  | 156.1 | 269.7 | 113.5 |
| 4 | read / sessions | 270.9 | 350.1 | 79.2 |
| 5 | read / rounds | 352.4 | 423.7 | 71.3 |
| 6 | source-write / rounds | 424.3 | 497.8 | 73.4 |
| 7 | source-write / matches | 498.5 | 572.3 | 73.8 |
| 8 | snapshot-write / match_players | 573.1 | 647.6 | 74.5 |
| 9 | source-write / sessions | 648.4 | 785.2 | 136.8 |
| 10 | transaction /  | 785.7 | 822.6 | 36.8 |
| 11 | read / groups | 831.7 | 905 | 73.2 |
| 12 | read / sessions | 831.8 | 904.7 | 72.9 |
| 13 | read / player_accounts, players | 831.8 | 910.2 | 78.3 |
| 14 | read / rounds | 831.8 | 903 | 71.1 |
| 15 | read / session_attendance | 831.9 | 906.4 | 74.6 |
| 16 | read / matches | 903.6 | 976 | 72.4 |
| 17 | read / match_players, matches | 903.7 | 975.4 | 71.7 |
| 18 | read / round_sits | 903.7 | 975.7 | 72.1 |
| 19 | read / group_organizers, groups | 979.2 | 1,052.3 | 73.1 |
| 20 | read / session_partner_requests | 1,052.8 | 1,130.3 | 77.5 |
| 21 | read / player_synergy | 1,052.9 | 1,124.3 | 71.5 |

### narrow / save-all, round4

DOM 894; server request 1,182.6; request/response body wrapper bytes 388/5245; browser first-byte→DOM 6.8; server-before-DOM time with no outstanding SQL 24.1. The latter includes compute, rendering, scheduling and instrumentation, rather than pure CPU.

| SQL | Class / tables | Start offset | End offset | Wall time |
| ---: | --- | ---: | ---: | ---: |
| 1 | read / group_organizers, groups | 7.7 | 77.1 | 69.4 |
| 2 | transaction /  | 77.5 | 112.6 | 35.1 |
| 3 | lock-call /  | 112.8 | 225 | 112.3 |
| 4 | read / matches, rounds, sessions | 225.9 | 298.8 | 72.9 |
| 5 | source-write / matches, unnest | 300.2 | 372.1 | 71.9 |
| 6 | read / player_accounts, players | 372.5 | 410.9 | 38.4 |
| 7 | read / match_players, matches, rounds, sessions | 411.4 | 562.3 | 150.8 |
| 8 | rating-write / desired_accounts, desired_players, desired_rosters, player_accounts, players, unnest | 571.2 | 644.1 | 72.9 |
| 9 | snapshot-write / desired_snapshots, match_players, matches, rounds, sessions, targets, unnest | 645.5 | 844.4 | 199 |
| 10 | transaction /  | 845.6 | 882.1 | 36.5 |
| 11 | read / groups | 887.3 | 964.8 | 77.5 |
| 12 | read / sessions | 887.3 | 965.8 | 78.4 |
| 13 | read / player_accounts, players | 887.4 | 964.9 | 77.5 |
| 14 | read / rounds | 887.4 | 965.3 | 77.9 |
| 15 | read / session_attendance | 887.4 | 964.5 | 77.1 |
| 16 | read / matches | 965.4 | 1,038.9 | 73.5 |
| 17 | read / match_players, matches | 965.5 | 1,038.9 | 73.4 |
| 18 | read / round_sits | 965.5 | 1,033.5 | 68.1 |
| 19 | read / group_organizers, groups | 1,039.3 | 1,109.5 | 70.2 |
| 20 | read / session_partner_requests | 1,110.1 | 1,180.4 | 70.4 |
| 21 | read / player_synergy | 1,110.2 | 1,184.2 | 74 |

### narrow / next, round5

DOM 1,381; server request 1,375.4; request/response body wrapper bytes 199/5814; browser first-byte→DOM 470.2; server-before-DOM time with no outstanding SQL 105.3. The latter includes compute, rendering, scheduling and instrumentation, rather than pure CPU.

| SQL | Class / tables | Start offset | End offset | Wall time |
| ---: | --- | ---: | ---: | ---: |
| 1 | read / sessions | 3.9 | 120.7 | 116.8 |
| 2 | read / rounds | 120.9 | 193.4 | 72.5 |
| 3 | read / group_organizers, groups | 194 | 268.3 | 74.2 |
| 4 | transaction /  | 268.5 | 302.1 | 33.6 |
| 5 | lock-call /  | 302.4 | 336.2 | 33.8 |
| 6 | read / match_players, matches, rounds | 336.4 | 404.9 | 68.5 |
| 7 | source-write / rounds | 405.2 | 474.4 | 69.2 |
| 8 | lock-call /  | 474.9 | 578 | 103.1 |
| 9 | read / player_accounts, players | 578.5 | 614.8 | 36.3 |
| 10 | read / match_players, matches, rounds, sessions | 615.4 | 757.9 | 142.6 |
| 11 | chemistry-write / player_synergy | 766.3 | 800.9 | 34.7 |
| 12 | chemistry-write / player_synergy, unnest | 801.7 | 871.8 | 70.2 |
| 13 | transaction /  | 872 | 906.6 | 34.6 |
| 14 | read / groups | 910.1 | 983.6 | 73.5 |
| 15 | read / sessions | 910.1 | 984.3 | 74.2 |
| 16 | read / player_accounts, players | 910.2 | 986.7 | 76.6 |
| 17 | read / rounds | 910.2 | 985.6 | 75.5 |
| 18 | read / session_attendance | 910.2 | 986.8 | 76.6 |
| 19 | read / matches | 986 | 1,138 | 152 |
| 20 | read / match_players, matches | 986 | 1,143.8 | 157.7 |
| 21 | read / round_sits | 986.1 | 1,138.5 | 152.5 |
| 22 | read / group_organizers, groups | 1,144.4 | 1,216.2 | 71.8 |
| 23 | read / session_partner_requests | 1,216.7 | 1,291.3 | 74.6 |
| 24 | read / player_synergy | 1,216.8 | 1,291.1 | 74.2 |

## history: representative request and every SQL interval

Offsets start at the actual click. Representatives are nearest their own action/viewport median, rather than sums of medians. Parallel intervals overlap. Full request span contains queries and streamed server rendering; never add nested spans.

### desktop / start, round5

DOM 620; server request 609.1; request/response body wrapper bytes 573/5459; browser first-byte→DOM 156.3; server-before-DOM time with no outstanding SQL 14.5. The latter includes compute, rendering, scheduling and instrumentation, rather than pure CPU.

| SQL | Class / tables | Start offset | End offset | Wall time |
| ---: | --- | ---: | ---: | ---: |
| 1 | read / sessions | 9.5 | 48.3 | 38.9 |
| 2 | read / group_organizers, groups | 49.1 | 84.3 | 35.2 |
| 3 | transaction /  | 84.6 | 123.2 | 38.6 |
| 4 | read / sessions | 123.7 | 162.1 | 38.4 |
| 5 | read / rounds | 162.4 | 203.1 | 40.7 |
| 6 | snapshot-write / inserted_matches, inserted_members, inserted_round, match_players, matches, round_sits, rounds, unnest | 203.6 | 327.4 | 123.8 |
| 7 | source-write / sessions | 327.8 | 366 | 38.1 |
| 8 | transaction /  | 366.4 | 457.8 | 91.4 |
| 9 | read / groups | 463 | 503.1 | 40.1 |
| 10 | read / sessions | 463 | 503.8 | 40.8 |
| 11 | read / player_accounts, players | 463 | 503.5 | 40.4 |
| 12 | read / match_players, matches, round_sits, rounds | 463.1 | 537.4 | 74.3 |
| 13 | read / session_attendance | 463.1 | 499.9 | 36.8 |
| 14 | read / group_organizers, groups | 538 | 574.1 | 36.1 |
| 15 | read / session_partner_requests | 574.6 | 611.9 | 37.3 |
| 16 | read / player_synergy | 574.6 | 613.7 | 39 |

### desktop / save-all, round9

DOM 648; server request 929.4; request/response body wrapper bytes 388/6980; browser first-byte→DOM 8.8; server-before-DOM time with no outstanding SQL 14. The latter includes compute, rendering, scheduling and instrumentation, rather than pure CPU.

| SQL | Class / tables | Start offset | End offset | Wall time |
| ---: | --- | ---: | ---: | ---: |
| 1 | read / group_organizers, groups | 4.4 | 112.6 | 108.2 |
| 2 | transaction /  | 113 | 147.5 | 34.5 |
| 3 | lock-call /  | 147.9 | 182.2 | 34.3 |
| 4 | read / matches, rounds, sessions | 182.4 | 219.7 | 37.3 |
| 5 | source-write / matches, unnest | 220.5 | 328.1 | 107.6 |
| 6 | read / player_accounts, players | 328.7 | 364.7 | 36 |
| 7 | read / match_players, matches, rounds, sessions | 365.1 | 549.8 | 184.8 |
| 8 | snapshot-write / desired_snapshots, match_players, matches, rounds, sessions, targets, unnest | 552.8 | 598.8 | 46 |
| 9 | transaction /  | 599.7 | 634.2 | 34.5 |
| 10 | read / groups | 639.2 | 748.8 | 109.6 |
| 11 | read / sessions | 639.2 | 748.2 | 109 |
| 12 | read / player_accounts, players | 639.2 | 748.7 | 109.5 |
| 13 | read / match_players, matches, round_sits, rounds | 639.2 | 852.8 | 213.6 |
| 14 | read / session_attendance | 639.3 | 748.5 | 109.3 |
| 15 | read / group_organizers, groups | 853.9 | 889.7 | 35.7 |
| 16 | read / session_partner_requests | 890.1 | 928.5 | 38.3 |
| 17 | read / player_synergy | 890.2 | 928.3 | 38.1 |

### desktop / next, round2

DOM 1,039; server request 1,034.2; request/response body wrapper bytes 199/4716; browser first-byte→DOM 303.3; server-before-DOM time with no outstanding SQL 71.3. The latter includes compute, rendering, scheduling and instrumentation, rather than pure CPU.

| SQL | Class / tables | Start offset | End offset | Wall time |
| ---: | --- | ---: | ---: | ---: |
| 1 | read / sessions | 5 | 43.2 | 38.3 |
| 2 | read / rounds | 43.5 | 161.7 | 118.2 |
| 3 | read / group_organizers, groups | 162.7 | 197.6 | 34.8 |
| 4 | transaction /  | 198.1 | 236.9 | 38.9 |
| 5 | lock-call /  | 237.2 | 277.1 | 39.8 |
| 6 | read / match_players, matches, rounds | 277.3 | 317.5 | 40.2 |
| 7 | source-write / rounds | 317.8 | 412 | 94.2 |
| 8 | lock-call /  | 412.4 | 450.5 | 38.1 |
| 9 | read / player_accounts, players | 450.8 | 491.4 | 40.6 |
| 10 | read / match_players, matches, rounds, sessions | 491.7 | 574.1 | 82.4 |
| 11 | chemistry-write / cleared, player_synergy, unnest | 576.8 | 693.1 | 116.3 |
| 12 | transaction /  | 693.3 | 732.9 | 39.7 |
| 13 | read / groups | 734.8 | 773.7 | 39 |
| 14 | read / sessions | 734.8 | 811.4 | 76.7 |
| 15 | read / player_accounts, players | 734.8 | 771.2 | 36.4 |
| 16 | read / match_players, matches, round_sits, rounds | 734.8 | 773.8 | 39 |
| 17 | read / session_attendance | 734.8 | 807.8 | 72.9 |
| 18 | read / group_organizers, groups | 811.7 | 936.7 | 125 |
| 19 | read / session_partner_requests | 936.9 | 973.5 | 36.6 |
| 20 | read / player_synergy | 936.9 | 976.6 | 39.7 |

### narrow / start, round5

DOM 637; server request 612.5; request/response body wrapper bytes 574/5475; browser first-byte→DOM 194.3; server-before-DOM time with no outstanding SQL 17.6. The latter includes compute, rendering, scheduling and instrumentation, rather than pure CPU.

| SQL | Class / tables | Start offset | End offset | Wall time |
| ---: | --- | ---: | ---: | ---: |
| 1 | read / sessions | 28 | 63.8 | 35.8 |
| 2 | read / group_organizers, groups | 64.7 | 100.4 | 35.7 |
| 3 | transaction /  | 100.8 | 137 | 36.2 |
| 4 | read / sessions | 137.2 | 173.6 | 36.4 |
| 5 | read / rounds | 173.8 | 299.6 | 125.7 |
| 6 | snapshot-write / inserted_matches, inserted_members, inserted_round, match_players, matches, round_sits, rounds, unnest | 300 | 349.7 | 49.6 |
| 7 | source-write / sessions | 350 | 394.4 | 44.4 |
| 8 | transaction /  | 394.7 | 437.8 | 43.1 |
| 9 | read / groups | 442.7 | 516.1 | 73.4 |
| 10 | read / sessions | 442.7 | 512 | 69.3 |
| 11 | read / player_accounts, players | 442.8 | 517.4 | 74.6 |
| 12 | read / match_players, matches, round_sits, rounds | 442.8 | 482.8 | 40 |
| 13 | read / session_attendance | 442.8 | 480.7 | 37.9 |
| 14 | read / group_organizers, groups | 517.7 | 554.1 | 36.4 |
| 15 | read / session_partner_requests | 554.5 | 591.3 | 36.7 |
| 16 | read / player_synergy | 554.6 | 631.3 | 76.7 |

### narrow / save-all, round3

DOM 664; server request 1,032.7; request/response body wrapper bytes 388/4877; browser first-byte→DOM 5.9; server-before-DOM time with no outstanding SQL 15.7. The latter includes compute, rendering, scheduling and instrumentation, rather than pure CPU.

| SQL | Class / tables | Start offset | End offset | Wall time |
| ---: | --- | ---: | ---: | ---: |
| 1 | read / group_organizers, groups | 8.3 | 44.7 | 36.4 |
| 2 | transaction /  | 45 | 81 | 36 |
| 3 | lock-call /  | 81.6 | 119 | 37.4 |
| 4 | read / matches, rounds, sessions | 119.3 | 158.2 | 38.9 |
| 5 | source-write / matches, unnest | 158.5 | 195.7 | 37.2 |
| 6 | read / player_accounts, players | 196.4 | 249.2 | 52.9 |
| 7 | read / match_players, matches, rounds, sessions | 250 | 491.7 | 241.8 |
| 8 | snapshot-write / desired_snapshots, match_players, matches, rounds, sessions, targets, unnest | 494.2 | 615.6 | 121.4 |
| 9 | transaction /  | 616.5 | 653.2 | 36.6 |
| 10 | read / groups | 658.1 | 705.9 | 47.8 |
| 11 | read / sessions | 658.2 | 754.6 | 96.5 |
| 12 | read / player_accounts, players | 658.3 | 712.3 | 54 |
| 13 | read / match_players, matches, round_sits, rounds | 658.3 | 787.6 | 129.2 |
| 14 | read / session_attendance | 658.4 | 706.6 | 48.2 |
| 15 | read / group_organizers, groups | 787.9 | 865 | 77.1 |
| 16 | read / session_partner_requests | 865.5 | 1,034.4 | 168.8 |
| 17 | read / player_synergy | 865.6 | 1,034.2 | 168.6 |

### narrow / next, round2

DOM 1,018; server request 1,010.4; request/response body wrapper bytes 199/4705; browser first-byte→DOM 216.6; server-before-DOM time with no outstanding SQL 72.6. The latter includes compute, rendering, scheduling and instrumentation, rather than pure CPU.

| SQL | Class / tables | Start offset | End offset | Wall time |
| ---: | --- | ---: | ---: | ---: |
| 1 | read / sessions | 7 | 42.8 | 35.8 |
| 2 | read / rounds | 43 | 190.2 | 147.2 |
| 3 | read / group_organizers, groups | 191.8 | 230.4 | 38.5 |
| 4 | transaction /  | 230.8 | 266.3 | 35.5 |
| 5 | lock-call /  | 266.5 | 302.8 | 36.2 |
| 6 | read / match_players, matches, rounds | 303.1 | 375.9 | 72.8 |
| 7 | source-write / rounds | 376.3 | 449.9 | 73.6 |
| 8 | lock-call /  | 450.3 | 487.6 | 37.2 |
| 9 | read / player_accounts, players | 487.9 | 526.4 | 38.5 |
| 10 | read / match_players, matches, rounds, sessions | 526.8 | 617 | 90.2 |
| 11 | chemistry-write / cleared, player_synergy, unnest | 621 | 755.5 | 134.5 |
| 12 | transaction /  | 755.7 | 797.9 | 42.1 |
| 13 | read / groups | 801.1 | 840.9 | 39.8 |
| 14 | read / sessions | 801.1 | 840.8 | 39.7 |
| 15 | read / player_accounts, players | 801.2 | 839.3 | 38.1 |
| 16 | read / match_players, matches, round_sits, rounds | 801.2 | 880.8 | 79.6 |
| 17 | read / session_attendance | 801.2 | 838.2 | 37 |
| 18 | read / group_organizers, groups | 881.1 | 918.7 | 37.6 |
| 19 | read / session_partner_requests | 919.1 | 957.4 | 38.3 |
| 20 | read / player_synergy | 919.2 | 957.2 | 38 |
