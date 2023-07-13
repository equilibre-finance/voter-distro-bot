FROM node:16
#WORKDIR /src
RUN cd /src && npm install
CMD [ "node", "/src/index.js" ]
