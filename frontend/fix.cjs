const fs = require('fs');
const path = 'C:/Users/BIT/Desktop/VANI/frontend/src/app/App.tsx';
let lines = fs.readFileSync(path, 'utf8').split(/\r?\n/);

const startIndex = lines.findIndex(l => l.includes('r.onend = () => setListening(false);'));

if (startIndex !== -1) {
  // We need to replace from startIndex + 1 until "Initializing VANI"
  // Actually, we just need to delete up to "Initializing VANI" and insert our code
  const endIndex = lines.findIndex((l, i) => i >= startIndex && l.includes('Initializing VANI'));
  
  if (endIndex !== -1) {
    const insertCode = [
      '    r.onerror = () => { setListening(false); setTranscript("Could not understand. Please try again."); };',
      '    recognitionRef.current = r;',
      '    r.start();',
      '  }, []);',
      '',
      '  const stopListening = useCallback(() => { recognitionRef.current?.stop(); setListening(false); }, []);',
      '  const handleMicClick = () => listening ? stopListening() : startListening();',
      '',
      '  useEffect(() => {',
      '    if (!listening && transcript.trim() !== "" && transcript !== "Voice recognition not supported." && transcript !== "Could not understand. Please try again.") {',
      '      const processVoice = async () => {',
      '        try {',
      '          const res = await voiceApi.processCommand(transcript);',
      '          const intentData = res.intent || {};',
      '          const intentName = intentData.intent || res.action;',
      '',
      '          if (intentName === "search_products") {',
      '            const query = intentData.query || intentData.category || intentData.brand || intentData.color || transcript;',
      '            setSearch(query);',
      '            setSubmittedSearch(query);',
      '          } else if (intentName === "open_cart") {',
      '            setCartOpen(true);',
      '          } else if (intentName === "add_to_cart") {',
      '            const prodName = intentData.product_name;',
      '            if (prodName) {',
      '              const found = allProducts.find(p => p.name.toLowerCase().includes(prodName.toLowerCase()));',
      '              if (found) {',
      '                addItem(found);',
      '                setCartOpen(true);',
      '              } else {',
      '                setTranscript(`Could not find ${prodName}`);',
      '                return;',
      '              }',
      '            }',
      '          } else if (intentName === "checkout") {',
      '            setCartOpen(true);',
      '          }',
      '          ',
      '          if (res.message) {',
      '             setTranscript(res.message);',
      '          }',
      '          ',
      '          setTimeout(() => setVoiceOpen(false), 3000);',
      '        } catch (e) {',
      '          console.error("Voice process error:", e);',
      '        }',
      '      };',
      '      processVoice();',
      '    }',
      '  }, [listening, transcript, allProducts, addItem]);',
      '',
      '  if (appLoading) {',
      '    return (',
      '      <div className="flex flex-col items-center justify-center min-h-screen bg-[#2B201D] text-[#F9F6F0]">',
      '        <Loader color="#E6D5B8" size={60} />',
      '        <div className="mt-8 text-sm tracking-widest uppercase" style={{ fontFamily: "\'Crox LightX\', sans-serif" }}>',
    ];
    
    // Replace from startIndex+1 to endIndex-1
    lines.splice(startIndex + 1, endIndex - startIndex - 1, ...insertCode);
    
    fs.writeFileSync(path, lines.join('\n'), 'utf8');
    console.log('Fixed App.tsx successfully');
  } else {
    console.log('Could not find Initializing VANI');
  }
} else {
  console.log('Could not find r.onend');
}
