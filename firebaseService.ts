import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const SYSTEM_PROMPT = `Aap Mufti Sahab ke "Shakir AI Assistant" hain. 
Tone: User ke lehje ke mutabiq apne aap ko dhalien (Adaptive Style).
- Agar user dostana (friendly) hai, to aap bhi dostana baat karein aur kabhi kabhi emojis 🙂 ka istemal karein.
- Agar user sanjida (strict/direct) hai, to aap bhi sanjida aur professional rahein, faltu baatein na karein.
Identity: Aapka naam "Shakir AI Assistant" hai.
Language: User ki zaban (Urdu, English, Pashto, Arabic, Roman Urdu) khud pehchanein aur usi zaban mein jawab dein.

Response Modes:
1. Short (Default): Nihayat mukhtasir aur to-the-point jawab dein.
2. Think: Thodi tafseel aur wazahat ke sath jawab dein.
3. Pro: Mukammal tafseeli jawab, behtar daleel aur wazahat ke sath dein.

User ne jo mode select kiya hoga, aapko usi ke mutabiq jawab dena hai.
Function: User ke sawal par Mufti Sahab ki kitabon (Books) ya unke pehle se diye gaye fatawa (Q&A Database) se jawab nikal kar dena. 
Redirection: Agar koi mushkil shar'ee masla ho, to bot user ko kahe ke wo "Q&A Section" ke zariye rabta karein.`;

let ai: GoogleGenAI | null = null;

const getAI = () => {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set");
    }
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
};

export const sendMessageStream = async (message: string, mode: 'Short' | 'Think' | 'Pro' = 'Short', history: { role: 'user' | 'model', parts: { text: string }[] }[] = [], customPrompt?: string) => {
  const genAI = getAI();
  const model = "gemini-3.1-pro-preview";
  
  const chat = genAI.chats.create({
    model,
    config: {
      systemInstruction: `${customPrompt || SYSTEM_PROMPT}\n\nCURRENT MODE: ${mode}. Is mode ke mutabiq jawab dein.`,
    },
    history: history,
  });

  return await chat.sendMessageStream({ message });
};

export const textToSpeech = async (text: string, voice: string = 'Male') => {
  const genAI = getAI();
  const model = "gemini-2.5-flash-preview-tts";
  
  // Fenrir is male, Kore is female
  const voiceName = (voice === 'Male' || voice === 'Fenrir') ? 'Fenrir' : 
                    (voice === 'Female' || voice === 'Kore') ? 'Kore' : 
                    voice;

  const response = await genAI.models.generateContent({
    model,
    contents: [{ parts: [{ text: `Parh kar sunayein: ${text}` }] }],
    config: {
      responseModalities: ["AUDIO" as any],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voiceName as any },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  return base64Audio;
};

export const connectLive = async (callbacks: any, voice: string = 'Male', customPrompt?: string) => {
  const genAI = getAI();
  const voiceName = (voice === 'Male' || voice === 'Fenrir') ? 'Fenrir' : 
                    (voice === 'Female' || voice === 'Kore') ? 'Kore' : 
                    voice;
  
  return genAI.live.connect({
    model: "gemini-2.5-flash-native-audio-preview-09-2025",
    callbacks,
    config: {
      responseModalities: ["AUDIO" as any],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName as any } },
      },
      systemInstruction: customPrompt || SYSTEM_PROMPT,
    },
  });
};

export const transcribeAudio = async (audioBase64: string, mimeType: string) => {
  const genAI = getAI();
  const model = "gemini-3.1-pro-preview";

  const response = await genAI.models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType,
              data: audioBase64,
            },
          },
          { text: "Is audio ko text mein convert karein. Sirf transcribed text dein, aur kuch nahi." }
        ],
      },
    ],
  });

  return response.text;
};
