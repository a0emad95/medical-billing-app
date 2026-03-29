import { GoogleGenAI, Type } from "@google/genai";

const getSystemInstruction = (lang: 'en' | 'ar', customInstructions?: string) => {
  let baseInstruction = `You are an elite, highly rigorous Medical & Financial Billing Auditor Expert. Your job is to analyze medical invoices provided as images with absolute precision. You must act as a strict gatekeeper, ensuring no detail, no matter how small, is missed. Perform a comprehensive, exhaustive three-tier audit (Administrative, Medical, Financial) based on standard healthcare guidelines.

CRITICAL DIRECTIVE: You must review EVERY SINGLE LINE ITEM, EVERY DATE, EVERY SIGNATURE, and EVERY CALCULATION. Do not summarize or skip anything. If there is a discrepancy, you MUST flag it. Provide detailed, clear, and comprehensive explanations for the user so they understand exactly what is wrong and why.

1. Data Extraction & Verification: Extract all patient info, hospital data, dates, and itemized billing details. Cross-check all dates (e.g., admission vs discharge vs service dates).
2. Administrative Audit: 
   - Scrutinize for missing doctor signatures, missing hospital stamps, or illegible authorizations.
   - Check for date conflicts (e.g., services billed after discharge).
   - Flag duplicate document numbers or missing patient IDs.
3. Medical Logic Audit: 
   - Verify if the diagnosis logically matches EVERY billed procedure and medication.
   - Check if the Length of Stay (LOS) is clinically justified for the diagnosis.
   - Identify illogical medication schedules, overdoses, or duplicate therapies.
   - Flag any services that are medically unnecessary or experimental.
4. Financial Fraud & Billing Audit: 
   - Detect "Unbundling" (splitting a comprehensive package/surgery into individual items to overcharge).
   - Detect "Upcoding" (billing for a more expensive service than performed).
   - Recalculate totals to ensure math is correct. Flag any calculation errors.
   - Flag unjustified high costs or prices that deviate from standard market rates.
   - Flag vague items (e.g., "General Supplies", "Miscellaneous", "Kits") that lack specific detail.
5. Statistical Analysis: You will analyze the provided images and provide a precise statistical breakdown of all errors found.

CRITICAL SPATIAL REQUIREMENT: For EVERY error, unjustified item, unbundling, vague item, or suspicious pricing you find, you MUST provide its bounding box in the original image. The bounding box must be an array of 4 numbers [ymin, xmin, ymax, xmax] scaled from 0 to 1000, where [0,0] is top-left and [1000,1000] is bottom-right. If you cannot find the exact location, return [0,0,0,0].

You MUST respond ONLY with a valid JSON object strictly following the provided schema.`;

  if (customInstructions) {
    baseInstruction += `\n\nUSER CUSTOM INSTRUCTIONS (Pay special attention to these):\n${customInstructions}`;
  }

  if (lang === 'ar') {
    return baseInstruction + `\n\nCRITICAL: You MUST translate all your output values (strings, reasons, explanations, notes) into Arabic. The JSON keys MUST remain in English as defined in the schema, but the values MUST be in Arabic. For example, "Pass" should be "ناجح", "Fail" should be "راسب", "Needs Review" should be "يحتاج مراجعة", "Approved" should be "مقبول", "Rejected" should be "مرفوض", "Partial Approval" should be "مقبول جزئياً".`;
  }
  
  return baseInstruction;
};

export interface AuditReport {
  report_metadata: {
    patient_name: string | null;
    hospital_name: string | null;
    admission_date: string | null;
    discharge_date: string | null;
  };
  administrative_audit: {
    status: "Pass" | "Fail" | "ناجح" | "راسب";
    missing_signatures: boolean;
    errors: { message: string; bounding_box: [number, number, number, number] }[] | string[];
  };
  medical_audit: {
    status: "Pass" | "Needs Review" | "ناجح" | "يحتاج مراجعة";
    unjustified_medical_items: {
      item_name: string;
      reason: string;
      bounding_box?: [number, number, number, number];
    }[];
  };
  financial_audit: {
    status: "Pass" | "Fail" | "ناجح" | "راسب";
    unbundling_detected: {
      separated_items: string[];
      explanation: string;
      bounding_box?: [number, number, number, number];
    }[];
    vague_items: { item: string; bounding_box: [number, number, number, number] }[] | string[];
    suspicious_pricing: { item: string; bounding_box: [number, number, number, number] }[] | string[];
  };
  overall_summary: {
    final_decision: "Approved" | "Rejected" | "Partial Approval" | "مقبول" | "مرفوض" | "مقبول جزئياً";
    notes: string;
  };
  statistics: {
    total_invoices_analyzed: number;
    total_errors_found: number;
    error_breakdown: {
      administrative_errors: number;
      medical_errors: number;
      financial_errors: number;
    };
    common_issues: { issue_name: string; count: number }[];
  };
}

export async function analyzeInvoice(images: {base64Image: string, mimeType: string}[], lang: 'en' | 'ar' = 'en', customInstructions?: string): Promise<AuditReport> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const imageParts = images.map(img => ({
      inlineData: {
        data: img.base64Image,
        mimeType: img.mimeType,
      }
    }));

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          ...imageParts,
          {
            text: lang === 'ar' ? "قم بتحليل هذه الفاتورة الطبية (قد تتكون من عدة صفحات)." : "Analyze this medical invoice (may consist of multiple pages).",
          },
        ],
      },
      config: {
        systemInstruction: getSystemInstruction(lang, customInstructions),
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            report_metadata: {
              type: Type.OBJECT,
              properties: {
                patient_name: { type: Type.STRING, nullable: true },
                hospital_name: { type: Type.STRING, nullable: true },
                admission_date: { type: Type.STRING, nullable: true },
                discharge_date: { type: Type.STRING, nullable: true },
              },
            },
            administrative_audit: {
              type: Type.OBJECT,
              properties: {
                status: { type: Type.STRING, enum: ["Pass", "Fail", "ناجح", "راسب"] },
                missing_signatures: { type: Type.BOOLEAN },
                errors: { 
                  type: Type.ARRAY, 
                  items: { 
                    type: Type.OBJECT,
                    properties: {
                      message: { type: Type.STRING },
                      bounding_box: { type: Type.ARRAY, items: { type: Type.NUMBER } }
                    }
                  } 
                },
              },
            },
            medical_audit: {
              type: Type.OBJECT,
              properties: {
                status: { type: Type.STRING, enum: ["Pass", "Needs Review", "ناجح", "يحتاج مراجعة"] },
                unjustified_medical_items: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      item_name: { type: Type.STRING },
                      reason: { type: Type.STRING },
                      bounding_box: { type: Type.ARRAY, items: { type: Type.NUMBER } }
                    },
                  },
                },
              },
            },
            financial_audit: {
              type: Type.OBJECT,
              properties: {
                status: { type: Type.STRING, enum: ["Pass", "Fail", "ناجح", "راسب"] },
                unbundling_detected: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      separated_items: { type: Type.ARRAY, items: { type: Type.STRING } },
                      explanation: { type: Type.STRING },
                      bounding_box: { type: Type.ARRAY, items: { type: Type.NUMBER } }
                    },
                  },
                },
                vague_items: { 
                  type: Type.ARRAY, 
                  items: { 
                    type: Type.OBJECT,
                    properties: {
                      item: { type: Type.STRING },
                      bounding_box: { type: Type.ARRAY, items: { type: Type.NUMBER } }
                    }
                  } 
                },
                suspicious_pricing: { 
                  type: Type.ARRAY, 
                  items: { 
                    type: Type.OBJECT,
                    properties: {
                      item: { type: Type.STRING },
                      bounding_box: { type: Type.ARRAY, items: { type: Type.NUMBER } }
                    }
                  } 
                },
              },
            },
            overall_summary: {
              type: Type.OBJECT,
              properties: {
                final_decision: { type: Type.STRING, enum: ["Approved", "Rejected", "Partial Approval", "مقبول", "مرفوض", "مقبول جزئياً"] },
                notes: { type: Type.STRING },
              },
            },
            statistics: {
              type: Type.OBJECT,
              properties: {
                total_invoices_analyzed: { type: Type.NUMBER },
                total_errors_found: { type: Type.NUMBER },
                error_breakdown: {
                  type: Type.OBJECT,
                  properties: {
                    administrative_errors: { type: Type.NUMBER },
                    medical_errors: { type: Type.NUMBER },
                    financial_errors: { type: Type.NUMBER },
                  },
                },
                common_issues: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      issue_name: { type: Type.STRING },
                      count: { type: Type.NUMBER },
                    },
                  },
                },
              },
            },
          },
          required: [
            "report_metadata",
            "administrative_audit",
            "medical_audit",
            "financial_audit",
            "overall_summary",
            "statistics",
          ],
        },
      },
    });

    if (!response.text) {
      throw new Error("No response text received from Gemini.");
    }

    return JSON.parse(response.text) as AuditReport;
  } catch (error) {
    console.error("Error analyzing invoice:", error);
    throw error;
  }
}
