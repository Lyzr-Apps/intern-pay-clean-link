'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, ChevronDown, ChevronUp, Copy, Check, AlertTriangle, X, DollarSign, Briefcase, Clock, Building, MapPin, Calendar, TrendingUp, MessageSquare, Users, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { callAIAgent } from '@/lib/aiAgent'
import { copyToClipboard } from '@/lib/clipboard'

// TypeScript interfaces based on actual test response
interface PayAssessmentResult {
  verdict: 'Fair' | 'Underpaid' | 'Exploited'
  currentStipend: number
  suggestedFairStipend: {
    min: number
    max: number
  }
  percentageDifference: number
  industryAverages: {
    roleAverage: number
    cityAverage: number
    source: string
  }
  benchmarkAnalysis: {
    verdict: string
    reasoning: string
    extremeCase: boolean
    safetyResources: string | null
  }
  negotiationCoaching: {
    scenarios: Array<{
      title: string
      steps: string[]
      tips: string[]
    }>
    preDraftedMessages: {
      professional: string
      firm: string
      casual: string
    }
    talkingPoints: string[]
    additionalResources: {
      dosDonts: {
        dos: string[]
        donts: string[]
      }
      timingAdvice: string
    }
  }
  anonymousStories: Array<{
    role: string
    city: string
    companyType: string
    situation: string
    outcome: string
    keyLesson: string
    relevanceScore: number
  }>
  summary: {
    overallAssessment: string
    nextSteps: string[]
    confidenceLevel: string
  }
}

interface FormData {
  role: string
  skills: string[]
  hoursPerWeek: number
  companyType: string
  city: string
  currentStipend: string
  duration: string
}

type ScreenState = 'assessment' | 'loading' | 'verdict'
type ToneType = 'professional' | 'firm' | 'casual'

export default function Home() {
  const [screenState, setScreenState] = useState<ScreenState>('assessment')
  const [formData, setFormData] = useState<FormData>({
    role: '',
    skills: [],
    hoursPerWeek: 40,
    companyType: '',
    city: '',
    currentStipend: '',
    duration: ''
  })
  const [skillInput, setSkillInput] = useState('')
  const [assessmentResult, setAssessmentResult] = useState<PayAssessmentResult | null>(null)
  const [messageDrawerOpen, setMessageDrawerOpen] = useState(false)
  const [selectedTone, setSelectedTone] = useState<ToneType>('professional')
  const [editedMessage, setEditedMessage] = useState('')
  const [copied, setCopied] = useState(false)
  const [safetyModalOpen, setSafetyModalOpen] = useState(false)
  const [expandedScenario, setExpandedScenario] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const roles = [
    'Software Dev',
    'Marketing',
    'Design',
    'Content',
    'Data Analytics',
    'HR',
    'Finance',
    'Operations',
    'Product Management',
    'Business Development'
  ]

  const companyTypes = ['Startup', 'MNC', 'Agency', 'NGO']

  const cities = [
    { name: 'Bangalore', tier: 'Tier 1' },
    { name: 'Mumbai', tier: 'Tier 1' },
    { name: 'Delhi', tier: 'Tier 1' },
    { name: 'Hyderabad', tier: 'Tier 1' },
    { name: 'Pune', tier: 'Tier 1' },
    { name: 'Chennai', tier: 'Tier 1' },
    { name: 'Kolkata', tier: 'Tier 2' },
    { name: 'Ahmedabad', tier: 'Tier 2' },
    { name: 'Gurgaon', tier: 'Tier 1' },
    { name: 'Noida', tier: 'Tier 1' }
  ]

  const durations = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']

  const handleSkillAdd = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && skillInput.trim()) {
      e.preventDefault()
      if (!formData.skills.includes(skillInput.trim())) {
        setFormData(prev => ({
          ...prev,
          skills: [...prev.skills, skillInput.trim()]
        }))
      }
      setSkillInput('')
    }
  }

  const handleSkillRemove = (skill: string) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.filter(s => s !== skill)
    }))
  }

  const handleSubmit = async () => {
    setError(null)

    // Validation
    if (!formData.role || !formData.companyType || !formData.city || !formData.currentStipend || !formData.duration) {
      setError('Please fill in all required fields')
      return
    }

    if (formData.skills.length === 0) {
      setError('Please add at least one skill')
      return
    }

    setScreenState('loading')

    // Construct message for the agent
    const message = `I'm a ${formData.role} intern in ${formData.city} working ${formData.hoursPerWeek} hours/week at a ${formData.companyType.toLowerCase()}. I have skills in ${formData.skills.join(', ')}. My current stipend is ₹${formData.currentStipend} per month for a ${formData.duration}-month internship. Is this fair?`

    try {
      const result = await callAIAgent(message, '6985af5c2a763ad393eee3ed')

      if (result.success && result.response.status === 'success') {
        const assessmentData = result.response.result as PayAssessmentResult
        setAssessmentResult(assessmentData)
        setScreenState('verdict')

        // Check for extreme case
        if (assessmentData.benchmarkAnalysis.extremeCase) {
          setSafetyModalOpen(true)
        }
      } else {
        setError(result.error || 'Failed to assess your pay. Please try again.')
        setScreenState('assessment')
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
      setScreenState('assessment')
    }
  }

  const handleDraftMessage = () => {
    if (assessmentResult) {
      setEditedMessage(assessmentResult.negotiationCoaching.preDraftedMessages[selectedTone])
      setMessageDrawerOpen(true)
    }
  }

  const handleCopyMessage = async () => {
    const success = await copyToClipboard(editedMessage)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const getVerdictColor = (verdict: string) => {
    switch (verdict) {
      case 'Fair':
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'Underpaid':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
      case 'Exploited':
        return 'bg-red-500/20 text-red-400 border-red-500/30'
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    }
  }

  const getOutcomeIcon = (outcome: string) => {
    switch (outcome) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-400" />
      case 'partial success':
        return <AlertCircle className="h-4 w-4 text-amber-400" />
      default:
        return <XCircle className="h-4 w-4 text-gray-400" />
    }
  }

  // Assessment Screen
  if (screenState === 'assessment') {
    return (
      <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl bg-[#2A2A2A] border-gray-700">
          <CardHeader className="text-center">
            <CardTitle className="text-4xl font-bold text-white mb-2">InternPay</CardTitle>
            <CardDescription className="text-gray-400 text-lg">
              Check if your internship stipend is fair
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <Alert className="bg-red-500/10 border-red-500/30 text-red-400">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Role */}
            <div className="space-y-2">
              <Label htmlFor="role" className="text-white flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-amber-500" />
                Role *
              </Label>
              <Select value={formData.role} onValueChange={(value) => setFormData(prev => ({ ...prev, role: value }))}>
                <SelectTrigger className="bg-[#1A1A1A] border-gray-600 text-white">
                  <SelectValue placeholder="Select your role" />
                </SelectTrigger>
                <SelectContent className="bg-[#2A2A2A] border-gray-600">
                  {roles.map(role => (
                    <SelectItem key={role} value={role} className="text-white focus:bg-[#3A3A3A] focus:text-white">
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Skills */}
            <div className="space-y-2">
              <Label htmlFor="skills" className="text-white">
                Skills (press Enter to add) *
              </Label>
              <Input
                id="skills"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={handleSkillAdd}
                placeholder="e.g., JavaScript, React, Node.js"
                className="bg-[#1A1A1A] border-gray-600 text-white placeholder:text-gray-500"
              />
              {formData.skills.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.skills.map(skill => (
                    <Badge key={skill} variant="secondary" className="bg-amber-500/20 text-amber-400 border border-amber-500/30 pr-1">
                      {skill}
                      <button onClick={() => handleSkillRemove(skill)} className="ml-1 hover:text-amber-300">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Hours Per Week */}
            <div className="space-y-2">
              <Label className="text-white flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                Hours per Week: {formData.hoursPerWeek}
              </Label>
              <Slider
                value={[formData.hoursPerWeek]}
                onValueChange={(value) => setFormData(prev => ({ ...prev, hoursPerWeek: value[0] }))}
                min={10}
                max={60}
                step={5}
                className="py-4"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>10 hrs</span>
                <span>60+ hrs</span>
              </div>
            </div>

            {/* Company Type */}
            <div className="space-y-2">
              <Label htmlFor="companyType" className="text-white flex items-center gap-2">
                <Building className="h-4 w-4 text-amber-500" />
                Company Type *
              </Label>
              <Select value={formData.companyType} onValueChange={(value) => setFormData(prev => ({ ...prev, companyType: value }))}>
                <SelectTrigger className="bg-[#1A1A1A] border-gray-600 text-white">
                  <SelectValue placeholder="Select company type" />
                </SelectTrigger>
                <SelectContent className="bg-[#2A2A2A] border-gray-600">
                  {companyTypes.map(type => (
                    <SelectItem key={type} value={type} className="text-white focus:bg-[#3A3A3A] focus:text-white">
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* City */}
            <div className="space-y-2">
              <Label htmlFor="city" className="text-white flex items-center gap-2">
                <MapPin className="h-4 w-4 text-amber-500" />
                City *
              </Label>
              <Select value={formData.city} onValueChange={(value) => setFormData(prev => ({ ...prev, city: value }))}>
                <SelectTrigger className="bg-[#1A1A1A] border-gray-600 text-white">
                  <SelectValue placeholder="Select your city" />
                </SelectTrigger>
                <SelectContent className="bg-[#2A2A2A] border-gray-600">
                  {cities.map(city => (
                    <SelectItem key={city.name} value={city.name} className="text-white focus:bg-[#3A3A3A] focus:text-white">
                      {city.name} <span className="text-gray-500 text-xs">({city.tier})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Current Stipend */}
            <div className="space-y-2">
              <Label htmlFor="stipend" className="text-white flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-amber-500" />
                Current Stipend (INR per month) *
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">₹</span>
                <Input
                  id="stipend"
                  type="number"
                  value={formData.currentStipend}
                  onChange={(e) => setFormData(prev => ({ ...prev, currentStipend: e.target.value }))}
                  placeholder="15000"
                  className="bg-[#1A1A1A] border-gray-600 text-white placeholder:text-gray-500 pl-7"
                />
              </div>
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <Label htmlFor="duration" className="text-white flex items-center gap-2">
                <Calendar className="h-4 w-4 text-amber-500" />
                Duration (months) *
              </Label>
              <Select value={formData.duration} onValueChange={(value) => setFormData(prev => ({ ...prev, duration: value }))}>
                <SelectTrigger className="bg-[#1A1A1A] border-gray-600 text-white">
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent className="bg-[#2A2A2A] border-gray-600">
                  {durations.map(duration => (
                    <SelectItem key={duration} value={duration} className="text-white focus:bg-[#3A3A3A] focus:text-white">
                      {duration} {duration === '1' ? 'month' : 'months'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleSubmit}
              className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold text-lg py-6"
            >
              Check My Pay
            </Button>

            <p className="text-xs text-gray-500 text-center">
              * All fields are required
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Loading Screen
  if (screenState === 'loading') {
    return (
      <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-16 w-16 animate-spin text-amber-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Analyzing your situation...</h2>
          <p className="text-gray-400">This will take just a moment</p>
        </div>
      </div>
    )
  }

  // Verdict Screen
  return (
    <div className="min-h-screen bg-[#1A1A1A] py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">InternPay</h1>
          <Button
            variant="ghost"
            onClick={() => {
              setScreenState('assessment')
              setAssessmentResult(null)
              setError(null)
            }}
            className="text-gray-400 hover:text-white"
          >
            ← New Assessment
          </Button>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Verdict and Numbers */}
          <div className="space-y-6">
            {/* Verdict Badge */}
            <Card className="bg-[#2A2A2A] border-gray-700">
              <CardHeader className="text-center">
                <div className={`inline-flex items-center justify-center px-8 py-4 rounded-lg border-2 ${getVerdictColor(assessmentResult!.verdict)} text-4xl font-bold mb-4`}>
                  {assessmentResult!.verdict}
                </div>
                <CardDescription className="text-gray-400 text-base">
                  {assessmentResult!.summary.overallAssessment}
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Stipend Comparison */}
            <Card className="bg-[#2A2A2A] border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-amber-500" />
                  Stipend Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Your Current Stipend</p>
                  <p className="text-3xl font-bold text-white">₹{assessmentResult!.currentStipend.toLocaleString()}</p>
                </div>
                <Separator className="bg-gray-700" />
                <div>
                  <p className="text-sm text-gray-400 mb-1">Fair Stipend Range</p>
                  <p className="text-3xl font-bold text-amber-500">
                    ₹{assessmentResult!.suggestedFairStipend.min.toLocaleString()} - ₹{assessmentResult!.suggestedFairStipend.max.toLocaleString()}
                  </p>
                </div>
                <div className={`p-3 rounded-lg ${assessmentResult!.percentageDifference < 0 ? 'bg-red-500/10 border border-red-500/30' : 'bg-green-500/10 border border-green-500/30'}`}>
                  <p className={`text-sm font-medium ${assessmentResult!.percentageDifference < 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {assessmentResult!.percentageDifference > 0 ? '+' : ''}{assessmentResult!.percentageDifference.toFixed(2)}% from fair range
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Industry Averages */}
            <Card className="bg-[#2A2A2A] border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Industry Benchmarks</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Role Average</span>
                  <span className="text-white font-semibold">₹{assessmentResult!.industryAverages.roleAverage.toLocaleString()}/mo</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">City Average</span>
                  <span className="text-white font-semibold">₹{assessmentResult!.industryAverages.cityAverage.toLocaleString()}/mo</span>
                </div>
                <Separator className="bg-gray-700" />
                <p className="text-xs text-gray-500">{assessmentResult!.industryAverages.source}</p>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button
                onClick={handleDraftMessage}
                className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold py-6"
              >
                <MessageSquare className="mr-2 h-5 w-5" />
                Draft Negotiation Message
              </Button>
            </div>
          </div>

          {/* Right Column: Coaching and Stories */}
          <div className="space-y-6">
            {/* Negotiation Scenarios */}
            <Card className="bg-[#2A2A2A] border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-amber-500" />
                  Negotiation Coaching
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Scenario-based guidance for your situation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {assessmentResult!.negotiationCoaching.scenarios.map((scenario, index) => (
                  <Collapsible
                    key={index}
                    open={expandedScenario === index}
                    onOpenChange={() => setExpandedScenario(expandedScenario === index ? null : index)}
                  >
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between p-3 bg-[#1A1A1A] rounded-lg hover:bg-[#333333] transition-colors">
                        <span className="text-white font-medium text-left">{scenario.title}</span>
                        {expandedScenario === index ? (
                          <ChevronUp className="h-5 w-5 text-amber-500" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-amber-500" />
                        )}
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2 p-3 bg-[#1A1A1A] rounded-lg space-y-3">
                      <div>
                        <p className="text-sm font-semibold text-amber-500 mb-2">Steps:</p>
                        <ol className="list-decimal list-inside space-y-1">
                          {scenario.steps.map((step, idx) => (
                            <li key={idx} className="text-sm text-gray-300">{step}</li>
                          ))}
                        </ol>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-amber-500 mb-2">Tips:</p>
                        <ul className="list-disc list-inside space-y-1">
                          {scenario.tips.map((tip, idx) => (
                            <li key={idx} className="text-sm text-gray-300">{tip}</li>
                          ))}
                        </ul>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </CardContent>
            </Card>

            {/* Talking Points */}
            <Card className="bg-[#2A2A2A] border-gray-700">
              <CardHeader>
                <CardTitle className="text-white text-lg">Key Talking Points</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {assessmentResult!.negotiationCoaching.talkingPoints.map((point, index) => (
                    <li key={index} className="flex gap-2 text-sm text-gray-300">
                      <span className="text-amber-500 mt-1">•</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Anonymous Stories */}
            <Card className="bg-[#2A2A2A] border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Users className="h-5 w-5 text-amber-500" />
                  Similar Intern Stories
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Learn from others in similar situations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {assessmentResult!.anonymousStories.slice(0, 3).map((story, index) => (
                  <div key={index} className="p-3 bg-[#1A1A1A] rounded-lg space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-white font-medium">{story.role}</p>
                        <p className="text-xs text-gray-500">{story.city} • {story.companyType}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {getOutcomeIcon(story.outcome)}
                        <span className="text-xs text-gray-400">{story.relevanceScore}%</span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-300">{story.situation}</p>
                    <div className="pt-2 border-t border-gray-700">
                      <p className="text-xs text-amber-400 font-medium">Key Lesson:</p>
                      <p className="text-xs text-gray-400">{story.keyLesson}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Next Steps */}
            <Card className="bg-[#2A2A2A] border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Next Steps</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-2">
                  {assessmentResult!.summary.nextSteps.map((step, index) => (
                    <li key={index} className="flex gap-2 text-sm text-gray-300">
                      <span className="text-amber-500 font-bold">{index + 1}.</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Legal Disclaimer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500">
            This is guidance only, not legal advice. Consult with appropriate professionals for specific situations.
          </p>
        </div>
      </div>

      {/* Message Drafting Slide-over */}
      <Sheet open={messageDrawerOpen} onOpenChange={setMessageDrawerOpen}>
        <SheetContent className="bg-[#2A2A2A] border-gray-700 w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-white">Draft Negotiation Message</SheetTitle>
            <SheetDescription className="text-gray-400">
              Customize your message and copy it to send to your manager
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6 mt-6">
            {/* Tone Selector */}
            <div className="space-y-2">
              <Label className="text-white">Select Tone</Label>
              <div className="flex gap-2">
                {(['professional', 'firm', 'casual'] as ToneType[]).map(tone => (
                  <Button
                    key={tone}
                    variant={selectedTone === tone ? 'default' : 'outline'}
                    onClick={() => {
                      setSelectedTone(tone)
                      if (assessmentResult) {
                        setEditedMessage(assessmentResult.negotiationCoaching.preDraftedMessages[tone])
                      }
                    }}
                    className={selectedTone === tone ? 'bg-amber-500 hover:bg-amber-600 text-black' : 'border-gray-600 text-gray-300 hover:bg-[#3A3A3A]'}
                  >
                    {tone.charAt(0).toUpperCase() + tone.slice(1)}
                  </Button>
                ))}
              </div>
            </div>

            {/* Message Textarea */}
            <div className="space-y-2">
              <Label className="text-white">Your Message</Label>
              <Textarea
                value={editedMessage}
                onChange={(e) => setEditedMessage(e.target.value)}
                rows={12}
                className="bg-[#1A1A1A] border-gray-600 text-white font-mono text-sm"
              />
            </div>

            {/* Talking Points Checklist */}
            {assessmentResult && (
              <div className="space-y-2">
                <Label className="text-white">Key Points to Mention</Label>
                <div className="bg-[#1A1A1A] p-3 rounded-lg space-y-2">
                  {assessmentResult.negotiationCoaching.talkingPoints.slice(0, 4).map((point, index) => (
                    <div key={index} className="flex gap-2 text-xs text-gray-400">
                      <Check className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
                      <span>{point}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Copy Button */}
            <Button
              onClick={handleCopyMessage}
              className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold"
              disabled={!editedMessage}
            >
              {copied ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy to Clipboard
                </>
              )}
            </Button>

            {/* Dos and Don'ts */}
            {assessmentResult && (
              <div className="space-y-3">
                <div className="bg-green-500/10 border border-green-500/30 p-3 rounded-lg">
                  <p className="text-sm font-semibold text-green-400 mb-2">Do:</p>
                  <ul className="space-y-1">
                    {assessmentResult.negotiationCoaching.additionalResources.dosDonts.dos.slice(0, 2).map((item, idx) => (
                      <li key={idx} className="text-xs text-gray-300 flex gap-2">
                        <Check className="h-3 w-3 text-green-400 mt-0.5 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-lg">
                  <p className="text-sm font-semibold text-red-400 mb-2">Don't:</p>
                  <ul className="space-y-1">
                    {assessmentResult.negotiationCoaching.additionalResources.dosDonts.donts.slice(0, 2).map((item, idx) => (
                      <li key={idx} className="text-xs text-gray-300 flex gap-2">
                        <X className="h-3 w-3 text-red-400 mt-0.5 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Timing Advice */}
            {assessmentResult && (
              <div className="bg-[#1A1A1A] p-3 rounded-lg">
                <p className="text-sm font-semibold text-amber-500 mb-2">Best Time to Ask:</p>
                <p className="text-xs text-gray-400">{assessmentResult.negotiationCoaching.additionalResources.timingAdvice}</p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Safety Modal for Extreme Cases */}
      {assessmentResult?.benchmarkAnalysis.extremeCase && (
        <Dialog open={safetyModalOpen} onOpenChange={setSafetyModalOpen}>
          <DialogContent className="bg-[#2A2A2A] border-red-500/50">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <AlertTriangle className="h-6 w-6 text-red-500" />
                Important Safety Information
              </DialogTitle>
              <DialogDescription className="text-gray-400">
                Your situation may require immediate attention
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Alert className="bg-red-500/10 border-red-500/30">
                <AlertTriangle className="h-4 w-4 text-red-400" />
                <AlertDescription className="text-red-400">
                  Based on your input, this appears to be an extreme case of unfair compensation or working conditions.
                </AlertDescription>
              </Alert>

              {assessmentResult.benchmarkAnalysis.safetyResources && (
                <div className="bg-[#1A1A1A] p-4 rounded-lg">
                  <p className="text-white font-medium mb-2">Resources Available:</p>
                  <p className="text-gray-300 text-sm">{assessmentResult.benchmarkAnalysis.safetyResources}</p>
                </div>
              )}

              <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-lg">
                <p className="text-amber-400 text-sm">
                  Consider documenting all communications and working hours. If you feel unsafe or exploited, please reach out to:
                </p>
                <ul className="mt-2 space-y-1 text-gray-300 text-sm">
                  <li>• Your college placement cell</li>
                  <li>• Labour department helpline</li>
                  <li>• Trusted mentors or career advisors</li>
                </ul>
              </div>

              <Button
                onClick={() => setSafetyModalOpen(false)}
                className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold"
              >
                I Understand
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
