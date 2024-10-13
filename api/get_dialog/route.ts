
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const templatePath1 = path.join(process.cwd(), 'app', '_prompts', 'pass1.txt');
    const templatePath2 = path.join(process.cwd(), 'app', '_prompts', 'pass2.txt');
    const templatePath3 = path.join(process.cwd(), 'app', '_prompts', 'pass3.txt');

    let geminiKey = '';
    if (process.env.GEMINI_API_KEY) {
      geminiKey = process.env.GEMINI_API_KEY;
    } else {
      // Handle the case where GEMINI_API_KEY is not set
      console.error('GEMINI_API_KEY is not defined!');
      throw new Error('GEMINI_API_KEY environment variable is not defined!');
      // You might want to throw an error here or provide a fallback mechanism
    }

    let generationConfig = {
      temperature: 1.0,
      topP: 0.95,
      topK: 64,
      maxOutputTokens: 32000,
      responseMimeType: 'text/plain', // fails only if this option is sent.
    };

    // Access your API key by creating an instance of GoogleGenerativeAI we'll call it GenAI
    let genAI = new GoogleGenerativeAI(geminiKey);
    console.log(process.env.GEMINI_API_KEY);
    let model = genAI.getGenerativeModel({
      model: 'gemini-1.5-pro',
      generationConfig: generationConfig,
    });

    // Read the template file
    const template1 = fs.readFileSync(templatePath1, 'utf-8');
    const template2 = fs.readFileSync(templatePath2, 'utf-8');
    const template3 = fs.readFileSync(templatePath3, 'utf-8');

    const { notes, assessment1, assessment2, template_num } = await req.json();

    let response_text = '';

    // Prompt 1
    if (template_num == 1) {
      let prompt1 = template1;
      Object.entries({ notes: notes }).forEach(([key, value]) => {
        prompt1 = prompt1.replace(new RegExp(`{${key}}`, 'g'), value);
      });

      // Pass the prompt to the model and retrieve the output
      const assessment1 = await model.generateContent(prompt1);
      const assessment1_string = assessment1.response.text();
      response_text = assessment1_string;
      // console.log(assessment1_string);
    } else if (template_num == 2) {
      // Pass 2
      let prompt2 = template2;
      Object.entries({ notes: notes, assessment1: assessment1 }).forEach(([key, value]) => {
        prompt2 = prompt2.replace(new RegExp(`{${key}}`, 'g'), value);
      });
      const assessment2 = await model.generateContent(prompt2);
      const assessment2_string = assessment2.response.text();
      console.log(assessment2_string);
      response_text = assessment2_string;
    } else if (template_num == 3) {
      // Pass 3
      let prompt3 = template3;
      Object.entries({
        notes: notes,
        assessment1: assessment1,
        assessment2: assessment2,
      }).forEach(([key, value]) => {
        prompt3 = prompt3.replace(new RegExp(`{${key}}`, 'g'), value);
      });
      generationConfig = {
        temperature: 1.5,
        topP: 0.95,
        topK: 64,
        maxOutputTokens: 128000,
        responseMimeType: 'text/plain', // fails only if this option is sent.
      };
      // Access your API key by creating an instance of GoogleGenerativeAI we'll call it GenAI
      genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      model = genAI.getGenerativeModel({
        model: 'gemini-1.5-pro',
        generationConfig: generationConfig,
      });
      const podcast_dialog = await model.generateContent(prompt3);
      const podcast_dialog_text = podcast_dialog.response.text();
      response_text = podcast_dialog_text;
      console.log(podcast_dialog_text);
    }

    // // Send the llm output as a server reponse object
    return NextResponse.json({ response: response_text }, { status: 200 });
    // res.status(200).json({ response: response_text }); //, assessment2: assessment2, podcast_dialog: podcast_dialog_text });
    // return NextResponse.json({ output: output });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
