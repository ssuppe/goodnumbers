import { GoogleGenerativeAI } from '@google/generative-ai';
// import { NextResponse } from "next/server";
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    res.status(405).json({ message: 'Method Not Allowed' });
  } else {
    try {
      const templatePath1 = path.join(process.cwd(), 'app', '_prompts', 'pass1.txt');

      const templatePath2 = path.join(process.cwd(), 'app', '_prompts', 'pass2.txt');

      const templatePath3 = path.join(process.cwd(), 'app', '_prompts', 'pass3.txt');

      // Read the template file
      const template1 = fs.readFileSync(templatePath1, 'utf-8');
      const template2 = fs.readFileSync(templatePath2, 'utf-8');
      const template3 = fs.readFileSync(templatePath3, 'utf-8');

      const { notes } = req.body;

      // const notes = notes;

      // Prompt 1
      let prompt1 = template1;
      Object.entries({ notes: notes }).forEach(([key, value]) => {
        prompt1 = prompt1.replace(new RegExp(`{${key}}`, 'g'), value);
      });

      let generationConfig = {
        temperature: 1.0,
        topP: 0.95,
        topK: 64,
        maxOutputTokens: 32000,
        responseMimeType: 'text/plain', // fails only if this option is sent.
      };
      // Access your API key by creating an instance of GoogleGenerativeAI we'll call it GenAI
      let genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      console.log(process.env.GEMINI_API_KEY);
      let model = genAI.getGenerativeModel({
        model: 'gemini-1.5-pro',
        generationConfig: generationConfig,
      });
      // Pass the prompt to the model and retrieve the output
      const assessment1 = await model.generateContent(prompt1);
      const assessment1_string = assessment1.response.text();
      console.log(assessment1_string);

      // // Pass 2
      // let prompt2 = template2;
      // Object.entries({ notes: notes, assessment1: assessment1_string }).forEach(([key, value]) => {
      //   prompt2 = prompt2.replace(new RegExp(`{${key}}`, 'g'), value);
      // });
      // const assessment2 = await model.generateContent(prompt2);
      // const assessment2_string = assessment2.response.text();
      // console.log(assessment2_string);

      // // Pass 3
      // let prompt3 = template3;
      // Object.entries({
      //   notes: notes,
      //   assessment1: assessment1_string,
      //   assessment2: assessment2_string,
      // }).forEach(([key, value]) => {
      //   prompt3 = prompt3.replace(new RegExp(`{${key}}`, 'g'), value);
      // });
      // generationConfig = {
      //   temperature: 1.5,
      //   topP: 0.95,
      //   topK: 64,
      //   maxOutputTokens: 32000,
      //   responseMimeType: 'text/plain', // fails only if this option is sent.
      // };
      // // Access your API key by creating an instance of GoogleGenerativeAI we'll call it GenAI
      // genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      // model = genAI.getGenerativeModel({
      //   model: 'gemini-1.5-pro',
      //   generationConfig: generationConfig,
      // });
      // const podcast_dialog = await model.generateContent(prompt3);
      // const podcast_dialog_text = podcast_dialog.response.text();
      // console.log(podcast_dialog_text);
      // // Send the llm output as a server reponse object
      res.status(200).json({ assessment1: assessment1_string}); //, assessment2: assessment2, podcast_dialog: podcast_dialog_text });
      // return NextResponse.json({ output: output });
    } catch (error) {
      console.error(error);
    }
  }
}
