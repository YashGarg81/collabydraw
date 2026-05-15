'use server'

import { SignupSchema } from '@repo/common/types';
import client from '@repo/db/client';
import bcrypt from "bcrypt";
import { z } from 'zod';

export async function signUp(values: z.infer<typeof SignupSchema>, referredBy?: string) {
    const validatedFields = SignupSchema.safeParse(values);

    if (!validatedFields.success) {
        return { error: "Invalid fields." };
    }

    const { name, email, password } = validatedFields.data;

    const existingUser = await client.user.findFirst({
        where: { email }
    });

    if (existingUser) {
        return { error: "User already exists." };
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        const referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        await client.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                referralCode,
                referredById: referredBy || null,
            },
        });

        // If referred by someone, give them 50 credits
        if (referredBy) {
            await client.user.update({
                where: { id: referredBy },
                data: { aiCredits: { increment: 50 } }
            });
            
            await client.aiUsage.create({
                data: {
                    userId: referredBy,
                    action: "referral_bonus",
                    credits: 50,
                    metadata: JSON.stringify({ referredUserEmail: email })
                }
            });
        }

        return { success: true };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Some Brutal Error';
        console.error("Error: ", errorMessage)
        return { error: "Error creating user." };
    }
}