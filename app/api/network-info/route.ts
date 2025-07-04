import { NextRequest, NextResponse } from 'next/server'
import { networkInterfaces } from 'os'

export async function GET(request: NextRequest) {
  try {
    const nets = networkInterfaces()
    const localIPs: string[] = []
    
    // Find local network IPs (not localhost)
    for (const name of Object.keys(nets)) {
      const interfaces = nets[name]
      if (interfaces) {
        for (const net of interfaces) {
          // Skip internal (i.e. 127.0.0.1) and non-ipv4 addresses
          if (net.family === 'IPv4' && !net.internal) {
            localIPs.push(net.address)
          }
        }
      }
    }
    
    // Get the port from the request
    const host = request.headers.get('host') || 'localhost:3000'
    const port = host.includes(':') ? host.split(':')[1] : '3000'
    
    // Get the protocol
    const protocol = request.headers.get('x-forwarded-proto') || 'http'
    
    return NextResponse.json({
      localIPs,
      port,
      protocol,
      host
    })
  } catch (error) {
    console.error('Error getting network info:', error)
    return NextResponse.json({ 
      error: 'Failed to get network information',
      localIPs: [],
      port: '3000',
      protocol: 'http',
      host: 'localhost:3000'
    }, { status: 500 })
  }
} 