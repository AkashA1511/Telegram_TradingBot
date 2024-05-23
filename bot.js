const TelegramBot = require('node-telegram-bot-api');
const { Web3 } = require('web3');
const fs = require('fs');
const path = require('path');

const token = "7102703341:AAFaE00Xyu33MPEQgkVjISeTNJvrj3NJ3WI";
const infuraProjectId = "Your-Infrua-Api-Key";
const contractAddress = "0x9Fae7CB288d1DB7B968F3fD932710DEa0412Aa8B";

const bot = new TelegramBot(token, { polling: true });
const web3 = new Web3(`https://sepolia.infura.io/v3/${infuraProjectId}`);

const contractABI = JSON.parse(fs.readFileSync(path.resolve(__dirname, './MyTokenABI.json'), 'utf-8'));
const contract = new web3.eth.Contract(contractABI, contractAddress);

// setting up only one account for simplicity
const senderPrivateKey = 'Your-Private-Key';
const senderAddress = web3.eth.accounts.privateKeyToAccount(senderPrivateKey).address;


bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const welcomeMessage = `Welcome to the CryptoBot! Here's what I can do for you:\n\n`
                        + `/createwallet - Create a new wallet and get your wallet address\n`
                        + `/sendETH - Send Ethereum to another address\n`
                        + `/sendtokens - Send custom tokens to another address\n`
                        + `/balance - Check the balance of Ethereum and custom tokens\n`
                        + `/checkhoneypot - Check if a token address is a honeypot\n\n`
                        + `Simply type one of the commands to get started!`;
    bot.sendMessage(chatId, welcomeMessage);
});
const createWallet = () => {
    const account = web3.eth.accounts.create();
    const walletDetails = `\nAddress: ${account.address}\nPrivate Key: ${account.privateKey}`;
    fs.appendFileSync('wallet_details.txt', walletDetails); 
    return account.address; 
  };
  
  bot.onText(/\/createwallet/, (msg) => {
    const chatId = msg.chat.id;
    const address = createWallet();
    bot.sendMessage(chatId, `Your wallet address: ${address}`);
  });

bot.onText(/\/sendETH/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Please provide the recipient address and amount (in ETH) separated by a space. Example: 0xRecipientAddress 1');
    bot.once('message', async (msg) => {
      const params = msg.text.split(' ');
      const [toAddress, amount] = params;
  
      try {
        const account = web3.eth.accounts.privateKeyToAccount(senderPrivateKey);
        const gasLimit = await web3.eth.estimateGas({ from: senderAddress, to: toAddress, value: web3.utils.toWei(amount, 'ether') });
        const gasPrice = await web3.eth.getGasPrice();
  
        const tx = {
          from: senderAddress,
          to: toAddress,
          value: web3.utils.toWei(amount, 'ether'),
          gas: gasLimit,
          gasPrice: gasPrice,
        };
  
        const signedTx = await account.signTransaction(tx);
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
  
        bot.sendMessage(chatId, `Transaction successful: ${receipt.transactionHash}`);
      } catch (error) {
        console.error(error);
        bot.sendMessage(chatId, `Transaction failed: ${error.message}`);
      }
    });
  });
  
bot.onText(/\/sendtokens/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Please provide the recipient address, amount, and decimals separated by spaces. Example: 0xRecipientAddress 100 18');
  
    bot.once('message', async (msg) => {
      const params = msg.text.split(' ');
      const [toAddress, amount, decimals] = params;
  
      try {
        const amountInSmallestUnit = parseInt(amount) * (10 ** parseInt(decimals)); // Convert to the smallest unit
        const data = contract.methods.transfer(toAddress, amountInSmallestUnit).encodeABI();
  
        const gasLimit = await web3.eth.estimateGas({
          from: senderAddress,
          to: contractAddress,
          data: data
        });
        const gasPrice = await web3.eth.getGasPrice();
  
        const tx = {
          from: senderAddress,
          to: contractAddress,
          data: data,
          gas: gasLimit,
          gasPrice: gasPrice
        };
  
        const account = web3.eth.accounts.privateKeyToAccount(senderPrivateKey);
        const signedTx = await account.signTransaction(tx);
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
  
        bot.sendMessage(chatId, `Token transfer successful: ${receipt.transactionHash}`);
      } catch (error) {
        bot.sendMessage(chatId, `Token transfer failed: ${error.message}`);
      }
    });
  });

  bot.onText(/\/balance/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Please enter the wallet address to check balance:');
    bot.once('message', async (msg) => {
        const address = msg.text;

        try {
            // Check Ethereum balance
            const ethBalance = await web3.eth.getBalance(address);
            bot.sendMessage(chatId, `ETH Balance: ${web3.utils.fromWei(ethBalance, 'ether')} ETH`);

            // Check token balance
            const tokenBalance = await contract.methods.balanceOf(address).call();
            bot.sendMessage(chatId, `Token Balance: ${tokenBalance} TOKENS`);
        } catch (error) {
            console.error(error);
            bot.sendMessage(chatId, 'Failed to check balance. Please try again.');
        }
    });
});

bot.onText(/\/checkhoneypot/, (msg) => {
    const chatId = msg.chat.id;

    // Prompt the user to enter the token address
    bot.sendMessage(chatId, 'Please enter the token address to check for honeypot:');

    // Listen for the user's response
    bot.once('message', (msg) => {
        const tokenAddress = msg.text;

        // Call the Honeypot API to check if the token address is a honeypot
        fetch(`https://api.honeypot.is/v2/IsHoneypot?address=${tokenAddress}`, {
            method: 'GET',
            headers: {
                'X-API-KEY': '' 
            }
        })
        .then(response => response.json())
        .then(data => {
            const risk = data.summary?.risk || '';
            const riskLevel = data.summary?.riskLevel?.toString() || '';
            const tokenName = data.token?.name || '';
            const isHoneypot = data.honeypotResult?.isHoneypot || false;

            // Send the extracted information back to the user
            bot.sendMessage(chatId, `
                Risk: ${risk}
                Risk Level: ${riskLevel}
                Token Name: ${tokenName}
                Honeypot: ${isHoneypot ? 'Yes' : 'No'}
            `);
        })
        .catch(error => {
            // Handle any errors that occur during API request
            console.error(error);
            bot.sendMessage(chatId, 'Failed to check for honeypot. Please try again later.');
        });
    });
});


bot.onText(/\/sendETH (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const params = match[1].split(' ');
  const [toAddress, amount] = params;
  sendEth(chatId, toAddress, amount);
});

bot.onText(/\/sendtokens (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const params = match[1].split(' ');
  const [toAddress, amount, decimals] = params;
  sendTokens(chatId, toAddress, amount, decimals);
});

async function sendEth(chatId, toAddress, amount) {
  try {
    const account = web3.eth.accounts.privateKeyToAccount(senderPrivateKey);
    const tx = {
      from: senderAddress,
      to: toAddress,
      value: web3.utils.toWei(amount, 'ether'),
      gas: 21000,
    };

    const signedTx = await account.signTransaction(tx);
    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

    bot.sendMessage(chatId, `Transaction successful: ${receipt.transactionHash}`);
  } catch (error) {
    bot.sendMessage(chatId, `Transaction failed: ${error.message}`);
    console.log(error);
  }
}




  
