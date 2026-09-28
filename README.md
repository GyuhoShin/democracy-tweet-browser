# Democracy Tweets Dataset

Authors: Gyuho Shin, Yoonyoung Na, and Woo-Yeon Jung

This repository provides data for a study of democracy-related discourse on Twitter. The tweets are written in Korean. The manuscript is currently being prepared for submission.

The browser displays 166,295 cleaned tweets from 2017–2022, classified into 9 clusters and 2,420 topics.

[Explore the tweets](https://gyuhoshin.github.io/democracy-tweet-browser/)

## Data files

The files are stored in [data/](data/).

- `Democracy_final_raw_data_clean_no_outliers.csv`: Analytical tweet data.
- `cluster_labels.csv`: Cluster names.
- `topic_labels.csv`: Topic names.

The tweet data include cleaned text, date, cluster, topic, and "impact factor". The browser supports keyword searches, date filtering, and browsing by cluster and topic.

The "impact factor" is the retweet count divided by the number of tweets in the corresponding topic over a 24-hour period. It can be interpreted as relative retweet volume.

For the detailed methodology, please refer to the paper once it is published.

The explorer source code and development instructions are in [explore/](explore/).
