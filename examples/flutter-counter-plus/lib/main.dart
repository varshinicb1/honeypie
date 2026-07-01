import 'package:flutter/material.dart';

void main() {
  runApp(const CounterPlusApp());
}

class CounterPlusApp extends StatelessWidget {
  const CounterPlusApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Counter Plus',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFFFF6B35)),
        useMaterial3: true,
      ),
      home: const CounterHome(),
    );
  }
}

class CounterHome extends StatefulWidget {
  const CounterHome({super.key});

  @override
  State<CounterHome> createState() => _CounterHomeState();
}

class _CounterHomeState extends State<CounterHome> {
  int count = 0;
  final List<int> history = [];

  void increment() {
    setState(() {
      count += 1;
      history.add(count);
    });
  }

  void reset() {
    setState(() {
      count = 0;
      history.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Counter Plus')),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Text('Today', style: Theme.of(context).textTheme.labelLarge),
          Text('$count', style: Theme.of(context).textTheme.displayLarge),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: increment,
            icon: const Icon(Icons.add),
            label: const Text('Add count'),
          ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: reset,
            icon: const Icon(Icons.restart_alt),
            label: const Text('Reset counter'),
          ),
          const Divider(height: 40),
          ListTile(
            leading: const Icon(Icons.insights),
            title: const Text('Stats'),
            subtitle: const Text('View streaks and recent counts'),
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => StatsScreen(history: history)),
            ),
          ),
          ListTile(
            leading: const Icon(Icons.feedback_outlined),
            title: const Text('Feedback'),
            subtitle: const Text('Send a note to the team'),
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const FeedbackScreen()),
            ),
          ),
        ],
      ),
    );
  }
}

class StatsScreen extends StatelessWidget {
  const StatsScreen({super.key, required this.history});

  final List<int> history;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Stats')),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Text('Recent counts', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 16),
          if (history.isEmpty)
            const Card(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: Text('No counts yet. Add a count from the home screen.'),
              ),
            )
          else
            for (final value in history.reversed.take(5))
              ListTile(
                leading: const Icon(Icons.check_circle_outline),
                title: Text('Count $value'),
              ),
        ],
      ),
    );
  }
}

class FeedbackScreen extends StatefulWidget {
  const FeedbackScreen({super.key});

  @override
  State<FeedbackScreen> createState() => _FeedbackScreenState();
}

class _FeedbackScreenState extends State<FeedbackScreen> {
  final controller = TextEditingController();

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Feedback')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: controller,
              decoration: const InputDecoration(
                labelText: 'Message',
                border: OutlineInputBorder(),
              ),
              maxLines: 4,
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: () => showDialog<void>(
                context: context,
                builder: (context) => AlertDialog(
                  title: const Text('Thanks'),
                  content: const Text('Your note was saved locally for this demo.'),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.of(context).pop(),
                      child: const Text('Close'),
                    ),
                  ],
                ),
              ),
              child: const Text('Submit feedback'),
            ),
          ],
        ),
      ),
    );
  }
}
