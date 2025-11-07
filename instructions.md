To summarize:
You will need to run 4 different terminals with the following commands.

    In "Resillientflow/mysterybox-backend/"

    Command= temporal server start-dev.

    Command= npm run start:worker (in backend folder).

    Command= npm run start:server (in backend folder).

    In "Resillientflow/frontend/"
    Command= npx live-server . (in frontend folder).

Then, everything will be connected and ready to go!

Alternatively with docker: docker-compose up --build