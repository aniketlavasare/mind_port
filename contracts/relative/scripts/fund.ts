import { network } from "hardhat";

const { ethers } = await network.connect({ network: "localhost", chainType: "l1" });

const TO = "0x67568FC3909C150df04fE916e9B7F52333B51A21";
const AMOUNT = ethers.parseEther("100");

const [funder] = await ethers.getSigners();
console.log("Funding from:", funder.address);
console.log("Sending 100 ETH →", TO);

const tx = await funder.sendTransaction({ to: TO, value: AMOUNT });
await tx.wait();

const balance = await ethers.provider.getBalance(TO);
console.log("✔ Done! New balance:", ethers.formatEther(balance), "ETH");
