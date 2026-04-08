import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { locations } = await req.json()
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

    if (!apiKey) {
      return NextResponse.json({ name: 'No API key configured', type: 'Setup required', mapsUrl: null })
    }

    // Use the first location as the search anchor
    const location = locations[0] || 'New York, NY'

    // Geocode the location
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${apiKey}`
    const geoRes = await fetch(geocodeUrl)
    const geoData = await geoRes.json()

    if (geoData.status !== 'OK' || !geoData.results?.[0]) {
      return NextResponse.json({ name: 'Could not geocode location', type: 'Error', mapsUrl: null })
    }

    const { lat, lng } = geoData.results[0].geometry.location

    // Search for date spots nearby
    const types = ['restaurant', 'bar', 'bowling_alley', 'movie_theater', 'amusement_park', 'cafe']
    const randomType = types[Math.floor(Math.random() * types.length)]

    const placesUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=5000&type=${randomType}&key=${apiKey}`
    const placesRes = await fetch(placesUrl)
    const placesData = await placesRes.json()

    if (placesData.status !== 'OK' || !placesData.results?.length) {
      return NextResponse.json({ name: 'No spots found nearby', type: 'Try again', mapsUrl: null })
    }

    // Pick a random one from the top 10
    const topResults = placesData.results.slice(0, 10)
    const picked = topResults[Math.floor(Math.random() * topResults.length)]

    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(picked.name)}&query_place_id=${picked.place_id}`

    return NextResponse.json({
      name: picked.name,
      type: picked.types?.[0]?.replace(/_/g, ' ') || 'Place',
      address: picked.vicinity,
      rating: picked.rating,
      mapsUrl,
    })
  } catch (error) {
    console.error('Date spot error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
