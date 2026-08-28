

export const AIResponseFormat = `
      interface Feedback {
      overallScore: number; //max 100
      ATS: {
        score: number; //rate based on ATS suitability
        tips: {
          type: "good" | "improve";
          tip: string; //give 3-4 tips
        }[];
      };
      toneAndStyle: {
        score: number; //max 100
        tips: {
          type: "good" | "improve";
          tip: string; //make it a short "title" for the actual explanation
          explanation: string; //explain in detail here
        }[]; //give 3-4 tips
      };
      content: {
        score: number; //max 100
        tips: {
          type: "good" | "improve";
          tip: string; //make it a short "title" for the actual explanation
          explanation: string; //explain in detail here
        }[]; //give 3-4 tips
      };
      structure: {
        score: number; //max 100
        tips: {
          type: "good" | "improve";
          tip: string; //make it a short "title" for the actual explanation
          explanation: string; //explain in detail here
        }[]; //give 3-4 tips
      };
      skills: {
        score: number; //max 100
        tips: {
          type: "good" | "improve";
          tip: string; //make it a short "title" for the actual explanation
          explanation: string; //explain in detail here
        }[]; //give 3-4 tips
      };
    }`;

export const prepareInstructions = ({
    jobTitle,
    jobDescription,
    language = "es",
    resumeText = "",
}: {
    jobTitle: string;
    jobDescription: string;
    language?: "es" | "en";
    resumeText?: string;
}) => {
    const isSpanish = language === "es";

    if (isSpanish) {
        return `Eres un evaluador experto en sistemas ATS (Applicant Tracking System) y análisis de currículums.
      Por favor analiza y califica este currículum y sugiere cómo mejorarlo.
      La puntuación puede ser baja si el CV tiene errores o carece de información relevante.
      Sé exhaustivo, detallado y profesional en tus explicaciones.
      El título del puesto objetivo es: ${jobTitle || "No especificado"}
      La descripción de la oferta laboral es: ${jobDescription || "No especificada"}
      El contenido de texto extraído del currículum es:
      --- INICIO CONTENIDO CV ---
      ${resumeText || "No se pudo extraer texto del documento"}
      --- FIN CONTENIDO CV ---
      Proporciona todas las sugerencias, explicaciones y consejos (tips) en IDIOMA ESPAÑOL.
      Proporciona la respuesta con el siguiente formato JSON estricto:
      ${AIResponseFormat}
      Retorna el análisis como un objeto JSON válido, sin texto adicional ni comillas invertidas.`;
    }

    return `You are an expert in ATS (Applicant Tracking System) and resume analysis.
      Please analyze and rate this resume and suggest how to improve it.
      The rating can be low if the resume is bad.
      Be thorough and detailed. Don't be afraid to point out any mistakes or areas for improvement.
      If available, use the job description for the job user is applying to to give more detailed feedback.
      If provided, take the job description into consideration.
      The job title is: ${jobTitle || "Not specified"}
      The job description is: ${jobDescription || "Not specified"}
      The extracted resume text content is:
      --- START RESUME CONTENT ---
      ${resumeText || "No text could be extracted from the document"}
      --- END RESUME CONTENT ---
      Provide all feedback, explanations and tips in ENGLISH.
      Provide the feedback using the following format:
      ${AIResponseFormat}
      Return the analysis as an JSON object, without any other text and without the backticks.
      Do not include any other text or comments.`;
};
