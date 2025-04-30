# Distributed Systems Exam Starter.

## Instructions to student.

This repository contains the starting code for a lab-based exam on the Distributed Systems module.
## Setup
You are required to take the following steps in preparation for this exam:
Fork this repository and clone it to your laptop. 
Import the project into VS Code and run the following commands:
~~~
$ npm install
$ npm run schema
$ git add -A
$ git commit -m "Added dependencies."
$ git push origin main
~~~

## The App.
Deploy the app to your AWS account (cdk deploy).

The app's infrastructure includes some lambdas, queues, a table, a topis, and a skeleton REST API. The table stores information about movie crews, e.g. directors, camera operators, etc. Some seed data is defined in the seed folder. 

Examine all aspects of the codebase before the exam, but do not change it until the exam begins. When you have fully understood the app, you may destroy the stack. However, redeploy the app again the day before the exam and leave it deployed.