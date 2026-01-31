require("dotenv").config();
const getChatResponse = require("./chat");

(async () => {
    console.log("Starting Chat Test...");
    try {
        const response = await getChatResponse("Hello, what is a palindrome?", {
            currentTask: { title: "Palindrome", description: "Write a palindrome function" },
            studentCode: "function isPalindrome(s) { return s === s.split('').reverse().join(''); }"
        });
        console.log("Chat Response Test Successful!");
        console.log("Response:", response);
    } catch (err) {
        console.error("Test Failed:", err.message);
    }
})();
