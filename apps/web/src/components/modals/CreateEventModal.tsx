import { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogClose
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../ui/select';
import { PartyPopper, Zap, X, Loader2 } from 'lucide-react';

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with the form data — can be async (returns a promise). */
  onCreate: (eventData: { name: string; description?: string; type?: string }) => void | Promise<void>;
  /** When true, the submit button shows a spinner and the form is disabled. */
  isCreating?: boolean;
}

export function CreateEventModal({ isOpen, onClose, onCreate, isCreating = false }: CreateEventModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onCreate({ 
      name, 
      type: type || undefined, 
      description: description || undefined,
    });
    // Reset form after successful creation
    setName('');
    setType('');
    setDescription('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent showCloseButton={false} className="sm:max-w-[480px] p-0 overflow-hidden border-border/20 bg-[#0f1115] shadow-2xl rounded-2xl">
        {/* Custom Close Button */}
        <DialogClose
          render={
            <button className="absolute right-6 top-6 p-1.5 rounded-full hover:bg-white/10 text-muted-foreground/50 hover:text-white transition-all duration-200 z-50 cursor-pointer" />
          }
        >
          <X className="h-4 w-4" />
        </DialogClose>

        <DialogHeader className="p-6 pb-2 flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary shadow-inner shadow-primary/20">
              <PartyPopper className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight text-white">Start a New Event</DialogTitle>
              <DialogDescription className="text-muted-foreground/80 mt-0.5 text-xs">
                Fill in the details to generate your immersive event space.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-5">
          <fieldset disabled={isCreating} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground/50 ml-0.5">Event Name</Label>
              <Input 
                id="name" 
                placeholder="Enter a memorable name for your event" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-11 bg-[#1a1d23] border-border/10 focus:border-primary/40 focus:ring-primary/10 transition-all duration-300 rounded-xl px-4 text-sm placeholder:text-muted-foreground/30"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type" className="text-xs font-bold uppercase tracking-wider text-muted-foreground/50 ml-0.5">Event Type</Label>
              <Select value={type} onValueChange={(val) => setType(val || '')} required>
                <SelectTrigger id="type" className="h-11 bg-[#1a1d23] border-border/10 focus:border-primary/40 focus:ring-primary/10 transition-all duration-300 rounded-xl px-4 text-sm min-w-full">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1d23] border-border/20 rounded-xl shadow-2xl p-1 min-w-[var(--radix-select-trigger-width)]">
                  <SelectItem value="Conference" className="focus:bg-primary/20 focus:text-white cursor-pointer rounded-lg py-1.5 px-3 text-sm">Conference</SelectItem>
                  <SelectItem value="Workshop" className="focus:bg-primary/20 focus:text-white cursor-pointer rounded-lg py-1.5 px-3 text-sm">Workshop</SelectItem>
                  <SelectItem value="Concert" className="focus:bg-primary/20 focus:text-white cursor-pointer rounded-lg py-1.5 px-3 text-sm">Concert</SelectItem>
                  <SelectItem value="Meetup" className="focus:bg-primary/20 focus:text-white cursor-pointer rounded-lg py-1.5 px-3 text-sm">Meetup</SelectItem>
                  <SelectItem value="Exhibition" className="focus:bg-primary/20 focus:text-white cursor-pointer rounded-lg py-1.5 px-3 text-sm">Exhibition</SelectItem>
                  <SelectItem value="Other" className="focus:bg-primary/20 focus:text-white cursor-pointer rounded-lg py-1.5 px-3 text-sm">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-xs font-bold uppercase tracking-wider text-muted-foreground/50 ml-0.5">Event Description</Label>
              <Textarea 
                id="description" 
                placeholder="Describe your event objective, audience, and key highlights..." 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[110px] bg-[#1a1d23] border-border/10 focus:border-primary/40 focus:ring-primary/10 transition-all duration-300 rounded-xl p-4 resize-none text-sm leading-relaxed placeholder:text-muted-foreground/30"
                required
              />
            </div>
          </fieldset>

          <div className="pt-4 flex flex-col-reverse sm:flex-row gap-3">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              disabled={isCreating}
              className="h-11 flex-1 border-border/10 hover:bg-white/5 text-white font-semibold rounded-xl transition-all duration-300 text-sm"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isCreating}
              className="h-11 flex-[1.5] bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/10 transition-all duration-300 rounded-xl flex items-center justify-center gap-2 group text-sm"
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Creating…</span>
                </>
              ) : (
                <>
                  <span>Generate Event Space</span>
                  <Zap className="h-4 w-4 fill-current group-hover:scale-110 transition-transform duration-300" />
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
