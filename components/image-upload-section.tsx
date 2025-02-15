'use client'

import { useCallback, useState, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { ArrowUpFromLine, ImageIcon, Loader2, ChevronDown, Image, Zap, Lock, HelpCircle } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from '@/lib/utils'
import { auth } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'

export function ImageUploadSection() {
  const [imageUrl, setImageUrl] = useState<string>('')
  const [promptStyle, setPromptStyle] = useState('Photography')
  const [isSignedIn, setIsSignedIn] = useState(false)
  const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null)

  // Check authentication state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsSignedIn(!!user)
      console.log('Auth state changed:', user ? 'Signed in' : 'Signed out')
    })

    return () => unsubscribe()
  }, [])

  const handleImageFile = (file: File) => {
    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)
    setImageFile(file)
    setImageUrl('')
    setGeneratedPrompt(null)
    setError(null)
  }

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (file) {
      handleImageFile(file)
    }
  }, [])

  // Handle image paste
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            handleImageFile(file)
            break
          }
        }
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [])

  const handleLoadUrl = async () => {
    if (!imageUrl) return
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch(imageUrl)
      if (!response.ok) throw new Error('Failed to fetch image')
      
      const blob = await response.blob()
      const file = new File([blob], 'image.jpg', { type: blob.type })
      handleImageFile(file)
    } catch (error) {
      setError('Invalid image URL or unable to load image')
      console.error('Error loading image URL:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const generatePrompt = async () => {
    if (!imageFile && !imageUrl) return
    if (!isSignedIn) {
      setError('Please sign in to generate prompts')
      return
    }
    
    setIsLoading(true)
    setError(null)
    
    try {
      // Get the current user's token
      const token = await auth.currentUser?.getIdToken()
      if (!token) {
        throw new Error('Authentication token not available')
      }

      let base64Data, mimeType;

      if (imageFile) {
        // Convert file to base64
        const base64Image = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(imageFile)
        })

        // Extract base64 data and mime type
        const matches = (base64Image as string).match(/^data:([^;]+);base64,(.+)$/)
        if (!matches) throw new Error('Invalid image format')
        ;[, mimeType, base64Data] = matches
      } else if (imageUrl) {
        // Fetch image from URL and convert to base64
        const response = await fetch(imageUrl)
        const blob = await response.blob()
        const base64Image = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })

        // Extract base64 data and mime type
        const matches = (base64Image as string).match(/^data:([^;]+);base64,(.+)$/)
        if (!matches) throw new Error('Invalid image format')
        ;[, mimeType, base64Data] = matches
      }

      const response = await fetch('/api/generate-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          image: base64Data,
          mimeType: mimeType,
          promptType: promptStyle.toLowerCase()
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 403) {
          setError('No credits remaining. Please purchase more credits to continue.')
          return
        }
        throw new Error(data.message || data.error || 'Failed to generate prompt')
      }

      setGeneratedPrompt(data.output)
      setIsLoading(false)

      // Dispatch credit update event
      window.dispatchEvent(new Event('creditUpdate'));

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to generate prompt')
      console.error('Error generating prompt:', error)
      setIsLoading(false)
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp']
    },
    multiple: false
  })

  const resetAll = () => {
    setPreview(null)
    setImageFile(null)
    setImageUrl('')
    setGeneratedPrompt(null)
    setError(null)
  }

  const faqItems = [
    {
      icon: <Image className="w-5 h-5" />,
      question: "What types of images work best?",
      answer: "Clear, high-quality images work best. The AI can analyze a wide range of subjects, from landscapes to portraits, but the clearer and more focused the image, the better the generated prompt will be."
    },
    {
      icon: <Zap className="w-5 h-5" />,
      question: "How accurate are the generated prompts?",
      answer: "Our AI strives to generate accurate and relevant prompts based on your images. However, results may vary depending on image quality and complexity. Feel free to modify the prompts to better match your needs."
    },
    {
      icon: <Lock className="w-5 h-5" />,
      question: "Can I use the prompts commercially?",
      answer: "Yes, the prompts generated are free to use for both personal and commercial purposes. However, please ensure you have the necessary rights to use the images you upload."
    },
    {
      icon: <HelpCircle className="w-5 h-5" />,
      question: "Is there a limit to how many prompts I can generate?",
      answer: "Currently, our service is free to use without any strict limits. However, we encourage responsible usage to ensure the best experience for all users."
    }
  ]

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
      {/* Top Bar with Glass Effect */}
      <div className="backdrop-blur-sm bg-background/50 rounded-xl p-4 mb-6 shadow-sm border">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <p className="text-sm font-medium">Prompt Style</p>
            <Select
              value={promptStyle}
              onValueChange={setPromptStyle}
            >
              <SelectTrigger className="w-[180px] h-9 text-sm bg-background/50">
                <SelectValue placeholder="Select style" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Photography">Photography</SelectItem>
                <SelectItem value="Digital Art">Digital Art</SelectItem>
                <SelectItem value="3D Render">3D Render</SelectItem>
                <SelectItem value="Oil Painting">Oil Painting</SelectItem>
                <SelectItem value="Watercolor">Watercolor</SelectItem>
                <SelectItem value="Sketch">Sketch</SelectItem>
                <SelectItem value="Midjourney">Midjourney</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Box - Image Upload Section */}
        <div className="space-y-4">
          <div className="backdrop-blur-sm bg-background/50 rounded-xl p-4 shadow-sm border">
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <Input
                type="url"
                placeholder="Paste image URL here"
                value={imageUrl}
                onChange={(e) => {
                  setImageUrl(e.target.value)
                  setError(null)
                }}
                className="flex-1 h-10 text-sm bg-background/50"
              />
              <Button 
                onClick={handleLoadUrl} 
                disabled={!imageUrl || isLoading}
                className="h-10 px-6 whitespace-nowrap text-sm bg-gradient-to-r from-gray-800 to-gray-700 hover:from-gray-700 hover:to-gray-600 text-white shadow-md transition-all duration-200"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Load URL'
                )}
              </Button>
            </div>

            <div
              {...getRootProps()}
              className={cn(
                'border-2 border-dashed rounded-xl transition-all duration-200',
                'hover:border-primary/50 hover:bg-muted/30',
                'flex flex-col items-center justify-center gap-3',
                'min-h-[300px] p-6 text-center cursor-pointer',
                isDragActive ? 'border-primary/50 bg-muted/30 scale-[0.99]' : 'border-muted-foreground/25'
              )}
            >
              <input {...getInputProps()} />
              {preview ? (
                <img
                  src={preview}
                  alt="Preview"
                  className="max-h-[260px] w-auto rounded-lg object-contain shadow-lg transition-transform duration-200 hover:scale-[1.02]"
                />
              ) : (
                <>
                  <div className="p-4 rounded-full bg-muted/30">
                    <ArrowUpFromLine className="h-8 w-8 text-muted-foreground/70" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-base font-medium">
                      Drop your image here
                    </p>
                    <p className="text-sm text-muted-foreground">
                      or click to browse from your computer
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground/75 space-y-1 mt-2">
                    <p>You can also paste an image directly (Ctrl/Cmd + V)</p>
                    <p>Supports: JPG, PNG and WEBP</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {error && (
            <div className="animate-in fade-in slide-in-from-top-1 duration-200">
              <p className="text-sm text-red-500 bg-red-500/10 rounded-xl px-4 py-3 border border-red-500/20">{error}</p>
            </div>
          )}
        </div>

        {/* Right Box - Generated Prompt Section */}
        <div className="space-y-4">
          <div className="backdrop-blur-sm bg-background/50 rounded-xl p-4 shadow-sm border">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium">Generated Prompt</p>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-background/80"
                onClick={() => {
                  if (generatedPrompt) {
                    navigator.clipboard.writeText(generatedPrompt)
                  }
                }}
                disabled={!generatedPrompt}
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 15 15"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                >
                  <path
                    d="M5 2V1H10V2H5ZM4.75 0C4.33579 0 4 0.335786 4 0.75V1H3.5C2.67157 1 2 1.67157 2 2.5V12.5C2 13.3284 2.67157 14 3.5 14H11.5C12.3284 14 13 13.3284 13 12.5V2.5C13 1.67157 12.3284 1 11.5 1H11V0.75C11 0.335786 10.6642 0 10.25 0H4.75ZM11 2V2.25C11 2.66421 10.6642 3 10.25 3H4.75C4.33579 3 4 2.66421 4 2.25V2H3.5C3.22386 2 3 2.22386 3 2.5V12.5C3 12.7761 3.22386 13 3.5 13H11.5C11.7761 13 12 12.7761 12 12.5V2.5C12 2.22386 11.7761 2 11.5 2H11Z"
                    fill="currentColor"
                    fillRule="evenodd"
                    clipRule="evenodd"
                  />
                </svg>
              </Button>
            </div>
            <div className="bg-background/50 rounded-xl p-4 min-h-[300px] border border-muted-foreground/10">
              {generatedPrompt ? (
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{generatedPrompt}</p>
              ) : (
                <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
                  <div className="p-4 rounded-full bg-muted/30">
                    <ImageIcon className="h-8 w-8" />
                  </div>
                  <p className="text-sm">Generated prompt will appear here</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Generate Button */}
      <div className="mt-6">
        <Button
          className="w-full h-12 text-base font-medium bg-gradient-to-r from-gray-800 to-gray-700 hover:from-gray-700 hover:to-gray-600 text-white shadow-lg transition-all duration-200 rounded-xl"
          onClick={generatePrompt}
          disabled={(!imageFile && !imageUrl) || isLoading || !isSignedIn}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Generating...
            </>
          ) : (
            <>
              <ImageIcon className="h-5 w-5 mr-2" />
              Generate Prompt
            </>
          )}
        </Button>
      </div>

      {/* How to Use Section */}
      <div className="mt-16 mb-8 relative">
        {/* Creative Background Elements */}
        <div className="absolute inset-0 overflow-hidden -z-10">
          <div className="absolute top-10 left-10 w-40 h-40 bg-gray-200/10 rounded-full blur-[100px]" />
          <div className="absolute bottom-10 right-10 w-48 h-48 bg-gray-300/10 rounded-full blur-[100px]" />
        </div>

        <div className="text-center mb-12 relative">
          <span className="inline-block mb-2 px-4 py-1 bg-gray-100/60 dark:bg-gray-800/40 rounded-full text-xs font-medium text-gray-800/90 dark:text-gray-300/90 backdrop-blur-md">Quick Guide</span>
          <h2 className="text-2xl font-medium bg-gradient-to-r from-gray-900/90 via-gray-800/90 to-gray-900/90 dark:from-gray-200/90 dark:via-gray-300/90 dark:to-gray-200/90 bg-clip-text text-transparent">
            Create Your Perfect Prompt
          </h2>
          <div className="mt-2 flex items-center justify-center gap-2 text-sm text-gray-600/80 dark:text-gray-400/80">
            <span className="inline-block w-12 h-[1px] bg-gradient-to-r from-transparent via-gray-400/40 dark:via-gray-600/40 to-transparent"></span>
            <p className="text-gray-700/80 dark:text-gray-400/80">Three simple steps</p>
            <span className="inline-block w-12 h-[1px] bg-gradient-to-r from-transparent via-gray-400/40 dark:via-gray-600/40 to-transparent"></span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* Step 1 */}
          <div className="group relative">
            <div className="bg-gradient-to-br from-white/90 to-white/50 dark:from-gray-800/50 dark:to-gray-800/30 backdrop-blur-xl rounded-xl p-6 
                          border border-white/20 dark:border-gray-700/30 shadow-[0_8px_16px_-6px_rgba(0,0,0,0.1)] dark:shadow-gray-900/20
                          transition-all duration-300 hover:shadow-lg hover:shadow-gray-200/20 dark:hover:shadow-gray-900/10 hover:-translate-y-1 group-hover:border-gray-200/40 dark:group-hover:border-gray-700/40">
              <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-gradient-to-br from-gray-800/80 to-gray-700/80 dark:from-gray-700/60 dark:to-gray-600/60
                            flex items-center justify-center text-white/90 font-medium text-sm ring-[3px] ring-white/60 dark:ring-gray-900/60 shadow-sm backdrop-blur-md">
                1
              </div>
              <div className="mb-4 p-3 bg-gradient-to-br from-gray-50/90 to-gray-100/50 dark:from-gray-700/50 dark:to-gray-700/30 rounded-lg w-fit backdrop-blur-md
                            group-hover:scale-110 transition-transform duration-300 shadow-sm">
                <ArrowUpFromLine className="h-5 w-5 text-gray-700/90 dark:text-gray-300/90" />
              </div>
              <h3 className="text-sm sm:text-base font-semibold text-gray-800/90 dark:text-gray-200/90 mb-2 group-hover:text-gray-900 dark:group-hover:text-white/90">Add Your Image</h3>
              <p className="text-xs text-gray-600/80 dark:text-gray-400/80 leading-relaxed">
                Drop, paste, or import your image – we make it easy
              </p>
            </div>
            <div className="hidden md:block absolute -right-4 top-1/2 -translate-y-1/2 text-gray-300/40 z-10">
              <div className="relative">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="animate-pulse opacity-70">
                  <path d="M5 12h14m-7-7l7 7-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div className="absolute inset-0 blur-md -z-10">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M5 12h14m-7-7l7 7-7 7" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="group relative">
            <div className="bg-gradient-to-br from-white/90 to-white/50 dark:from-gray-800/50 dark:to-gray-800/30 backdrop-blur-xl rounded-xl p-6 
                          border border-white/20 dark:border-gray-700/30 shadow-[0_8px_16px_-6px_rgba(0,0,0,0.1)] dark:shadow-gray-900/20
                          transition-all duration-300 hover:shadow-lg hover:shadow-gray-200/20 dark:hover:shadow-gray-900/10 hover:-translate-y-1 group-hover:border-gray-200/40 dark:group-hover:border-gray-700/40">
              <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-gradient-to-br from-gray-800/80 to-gray-700/80 dark:from-gray-700/60 dark:to-gray-600/60
                            flex items-center justify-center text-white/90 font-medium text-sm ring-[3px] ring-white/60 dark:ring-gray-900/60 shadow-sm backdrop-blur-md">
                2
              </div>
              <div className="mb-4 p-3 bg-gradient-to-br from-gray-50/90 to-gray-100/50 dark:from-gray-700/50 dark:to-gray-700/30 rounded-lg w-fit backdrop-blur-md
                            group-hover:scale-110 transition-transform duration-300 shadow-sm">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-gray-700/90 dark:text-gray-300/90"
                >
                  <path d="M21 8v13H3V8M1 3h22v5H1z" />
                  <path d="M10 12h4" />
                </svg>
              </div>
              <h3 className="text-sm sm:text-base font-semibold text-gray-800/90 dark:text-gray-200/90 mb-2 group-hover:text-gray-900 dark:group-hover:text-white/90">Pick Your Style</h3>
              <p className="text-xs text-gray-600/80 dark:text-gray-400/80">
                Choose from our curated collection of artistic styles
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="group">
            <div className="bg-gradient-to-br from-white/90 to-white/50 dark:from-gray-800/50 dark:to-gray-800/30 backdrop-blur-xl rounded-xl p-6 
                          border border-white/20 dark:border-gray-700/30 shadow-[0_8px_16px_-6px_rgba(0,0,0,0.1)] dark:shadow-gray-900/20
                          transition-all duration-300 hover:shadow-lg hover:shadow-gray-200/20 dark:hover:shadow-gray-900/10 hover:-translate-y-1 group-hover:border-gray-200/40 dark:group-hover:border-gray-700/40">
              <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-gradient-to-br from-gray-800/80 to-gray-700/80 dark:from-gray-700/60 dark:to-gray-600/60
                            flex items-center justify-center text-white/90 font-medium text-sm ring-[3px] ring-white/60 dark:ring-gray-900/60 shadow-sm backdrop-blur-md">
                3
              </div>
              <div className="mb-4 p-3 bg-gradient-to-br from-gray-50/90 to-gray-100/50 dark:from-gray-700/50 dark:to-gray-700/30 rounded-lg w-fit backdrop-blur-md
                            group-hover:scale-110 transition-transform duration-300 shadow-sm">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-gray-700/90 dark:text-gray-300/90"
                >
                  <path d="M12 2v20M2 12h20" />
                </svg>
              </div>
              <h3 className="text-sm sm:text-base font-semibold text-gray-800/90 dark:text-gray-200/90 mb-2 group-hover:text-gray-900 dark:group-hover:text-white/90">Transform</h3>
              <p className="text-xs text-gray-600/80 dark:text-gray-400/80">
                Watch as your image inspires the perfect prompt
              </p>
            </div>
          </div>
        </div>

        {/* Pro Tips with Creative Design */}
        <div className="mt-10">
          <div className="bg-gradient-to-br from-white/90 to-white/50 dark:from-gray-800/50 dark:to-gray-800/30 backdrop-blur-xl rounded-xl p-5 
                        border border-white/20 dark:border-gray-700/30 shadow-[0_8px_16px_-6px_rgba(0,0,0,0.1)] dark:shadow-gray-900/20">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-gray-50/90 to-gray-100/50 dark:from-gray-700/50 dark:to-gray-700/30
                            flex items-center justify-center backdrop-blur-md shadow-sm">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-gray-700/90 dark:text-gray-300/90"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800/90 dark:text-gray-200/90 mb-0.5">Quick Tip</p>
                <p className="text-xs text-gray-600/80 dark:text-gray-400/80">
                  Speed up your workflow by using Ctrl/Cmd + V to paste images directly from your clipboard
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-16 mb-8 relative">
          {/* Creative Background Elements */}
          <div className="absolute inset-0 overflow-hidden -z-10">
            <div className="absolute top-10 left-10 w-40 h-40 bg-gray-200/10 rounded-full blur-[100px]" />
            <div className="absolute bottom-10 right-10 w-48 h-48 bg-gray-300/10 rounded-full blur-[100px]" />
          </div>

          <div className="text-center mb-12 relative">
            <span className="inline-block mb-2 px-4 py-1 bg-gray-100/60 dark:bg-gray-800/40 rounded-full text-xs font-medium text-gray-800/90 dark:text-gray-300/90 backdrop-blur-md">FAQ</span>
            <h2 className="text-2xl font-medium bg-gradient-to-r from-gray-900/90 via-gray-800/90 to-gray-900/90 dark:from-gray-200/90 dark:via-gray-300/90 dark:to-gray-200/90 bg-clip-text text-transparent">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="grid gap-4">
            {faqItems.map((item, index) => (
              <div
                key={index}
                className="bg-gradient-to-br from-white/90 to-white/50 dark:from-gray-800/50 dark:to-gray-800/30 backdrop-blur-xl rounded-xl 
                          border border-white/20 dark:border-gray-700/30 shadow-[0_8px_16px_-6px_rgba(0,0,0,0.1)] dark:shadow-gray-900/20
                          transition-all duration-200 hover:shadow-lg hover:shadow-gray-200/20 dark:hover:shadow-gray-900/10"
              >
                <button
                  onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                  className="w-full px-6 py-4 flex items-center justify-between gap-4 text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gray-100/80 dark:bg-gray-800/80">
                      {item.icon}
                    </div>
                    <h3 className="text-base font-semibold text-gray-800/90 dark:text-gray-200/90">
                      {item.question}
                    </h3>
                  </div>
                  <ChevronDown 
                    className={cn(
                      "w-5 h-5 text-gray-500 transition-transform duration-200",
                      openFaqIndex === index ? "transform rotate-180" : ""
                    )} 
                  />
                </button>
                <div className={cn(
                  "grid transition-all duration-200",
                  openFaqIndex === index ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                )}>
                  <div className="overflow-hidden">
                    <p className="px-6 pb-4 text-sm text-gray-600/80 dark:text-gray-400/80">
                      {item.answer}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

