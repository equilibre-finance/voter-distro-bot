FROM node:16
WORKDIR /src
RUN npm install
CMD [ "node", "index.js" ]
