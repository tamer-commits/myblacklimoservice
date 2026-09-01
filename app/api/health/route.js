import { NextResponse } from 'next/server';
import { dbConfigured } from '../../../lib/db';
import { messagingConfigured } from '../../../lib/notify';
export async function GET(){return NextResponse.json({ok:true,service:'My Black Limo Service',mapsConfigured:Boolean(process.env.GOOGLE_MAPS_API_KEY),analyticsConfigured:Boolean(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID),dbConfigured:dbConfigured(),messagingConfigured:messagingConfigured(),timestamp:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}})}
