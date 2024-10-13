import { NextResponse } from 'next/server';

   export async function POST(request: Request) {
     console.log('get_dialog route handler called');
     try {
       const body = await request.json();
       console.log('Request body:', body);
       // Your implementation here
       return NextResponse.json({ message: 'Hello from get_dialog' });
     } catch (error) {
       console.error('Error in get_dialog:', error);
       return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
     }
   }
   export async function GET(request: Request) {
    console.log('Test GET route called');
    return NextResponse.json({ message: 'Test GET route works' });
  }
  