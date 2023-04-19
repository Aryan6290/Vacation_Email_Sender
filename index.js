const fs = require('fs').promises;
const path = require('path');
const process = require('process');
const {authenticate} = require('@google-cloud/local-auth');
const {google} = require('googleapis');

// If modifying these scopes, delete token.json.
const SCOPES = ['https://mail.google.com/'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}
// util function to search for key in an array
function searchforKey(nameKey, myArray){
    for (let i=0; i < myArray.length; i++) {
        if (myArray[i].name === nameKey) {
            return myArray[i].value;
        }
    }
}
/**
 * Serializes credentials to a file compatible with GoogleAUth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

/**
 * Lists the labels in the user's account.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
async function listLabels(auth) {
  const gmail = google.gmail({version: 'v1', auth});
  const res = await gmail.users.labels.list({
    userId: 'me',
  });
  const labels = res.data.labels;
  if (!labels || labels.length === 0) {
    console.log('No labels found.');
    return;
  }
  console.log('Labels:');
  labels.forEach((label) => {
    console.log(`- ${label.name}`);
  });
}

async function getUnreadMails(auth){
    const gmail = google.gmail({version: 'v1', auth});
    // getting all unread mails
    const res = await gmail.users.messages.list({
    userId: 'me',
    q: "is:unread -from:me from:email"
    });
    const newEmails = res.data.messages
    return newEmails;
}

const replyEmail =async(auth,messageID,threadId)=>{
    const gmail = google.gmail({version: 'v1', auth});
    // getting the actual mail using its id
    const mail = await gmail.users.messages.get({
        userId:'me',
        id : messageID,
    })
    // console.log(mail.data.payload.headers)
    const originalSender = searchforKey("From",mail.data.payload.headers)
    const subject = searchforKey("Subject",mail.data.payload.headers)
    const formattedSender = originalSender.substring(1, originalSender.length-1);
    const formattedMessage = `Re : ${subject}`
    console.log(formattedSender)

    const utf8Subject = `=?utf-8?B?${Buffer.from(formattedMessage).toString('base64')}?=`;

    // creating a message to reply
  const messageParts = [
    'From: me',
    `To: ${originalSender}`,
    `Subject: ${utf8Subject}`,
    `In-Reply-To: ${messageID}`,
    `References: ${messageID}`,
    '',
    'Hi, I am currently on leave, will reply as soon I am back!',
  ];
  const message = messageParts.join('\n');

  // The body needs to be base64url encoded.
  const encodedMessage = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

    // threadid is used to reply to the mail
  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedMessage,
      threadId :threadId
    },
  });
  console.log(res.data);
  return res.data.id;
}

const createVacationLabel=async(auth)=>{
    const gmail = google.gmail({version: 'v1', auth});
    try {

        // Creating a label
        const newLabel = await gmail.users.labels.create({
            userId:'me',
            requestBody:{
                name: "VACATION!!",
                messageListVisibility:"show",
                labelListVisibility: "labelShow"
            }
        })
        return newLabel.data.id
    } catch (error) {
        // iF Label already exists
        if(error.code == 409){
            const res = await gmail.users.labels.list({
                userId:'me'
            });
            const labelID = res.data.labels.find((label)=> label.name ==="VACATION!!")
            return labelID.id;
        }
    }
   
}

const addLabelToMessage = async(auth,messageID,labelId)=>{
    // adding label to the message
    const gmail = google.gmail({version: 'v1', auth});
    const res = await gmail.users.messages.modify({
        userId: 'me',
        id: messageID,
        requestBody: {
          addLabelIds: [labelId],
        },
      });
      console.log(res.data);
      return res.data;
}


const vacationMailer = async(auth)=>{
   const labelID = await createVacationLabel(auth);
   console.log(labelID)
    setTimeout(async() => {
        const mails = await getUnreadMails(auth);
        console.log(mails)
        for(let i=0;i<mails.length;i++){
           const repliedMailID = await  replyEmail(auth,newEmails[0].id, newEmails[0].threadId);
           console.log("Mail replied!")
            await addLabelToMessage(auth,repliedMailID, labelID);
           console.log("label added")

        }
       
    }, Math.floor(Math.random() * ((120 - 45 + 1)) + 45)*1000);

}


setTimeout(() => {
    authorize().then(vacationMailer).catch(console.error);
},Math.random()*100 );