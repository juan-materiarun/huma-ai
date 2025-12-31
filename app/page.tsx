import Chat from './components/Chat'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-4xl">
        {/* Chat Component */}
        <Chat />
      </div>
    </main>
  )
}

